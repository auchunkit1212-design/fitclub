import {
  fetchPasswordHashForEmail,
  fetchUserByEmailForAuth,
  registryUserToSession,
} from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  AI_SOLO_TENANT_NAME,
  AI_SOLO_TENANT_SLUG,
} from "@/lib/registry-constants";
import { getSupabaseAdmin, getSupabaseServiceRole } from "@/lib/supabase-admin";
import {
  createTenantWithCoach,
  ensureAiSoloTenant,
  fetchTenantById,
  fetchTenantByInviteCode,
} from "@/lib/tenant";
import type { RegistryUser, Tenant, UserSession } from "@/lib/types";
import { enrichSession, loginWithCredentials } from "@/lib/auth";

export type PublicRegisterRole = "coach" | "student";

export interface PublicRegisterInput {
  role: PublicRegisterRole;
  email: string;
  password: string;
  name: string;
  gymName?: string;
  inviteCode?: string;
  /** 明確標記 B2C 散客註冊（無邀請碼） */
  soloStudent?: boolean;
}

async function finishStudentRegistration(
  email: string,
  password: string,
  tenant: Tenant,
  isSolo: boolean
): Promise<UserSession> {
  const hash = await fetchPasswordHashForEmail(email);
  if (!hash) {
    throw new Error(
      "註冊後無法寫入密碼，請確認 Vercel 已設定 SUPABASE_SERVICE_ROLE_KEY。"
    );
  }
  const ok = await verifyPassword(password, hash);
  if (!ok) {
    throw new Error("密碼驗證失敗，請重新註冊或聯絡教練。");
  }

  try {
    const session = await loginWithCredentials(email, password);
    return {
      ...session,
      isSoloStudent: isSolo,
      tenantSlug: tenant.slug,
    };
  } catch (loginErr) {
    console.warn("[register] login after insert fallback:", loginErr);
    const user = await fetchUserByEmailForAuth(email);
    if (!user) throw loginErr;
    let session = registryUserToSession(user);
    session = await enrichSession(session, user);
    return {
      ...session,
      isSoloStudent: isSolo,
      tenantSlug: tenant.slug,
    };
  }
}

async function syncSupabaseAuthUser(email: string, password: string): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error && !error.message.includes("already")) {
      console.warn("[register] Supabase Auth createUser:", error.message);
    }
  } catch (err) {
    console.warn("[register] Supabase Auth skipped", err);
  }
}

async function resolveStudentTenant(input: PublicRegisterInput): Promise<{
  tenant: Tenant;
  gymLabel: string;
  addedBy: string | null;
  isSolo: boolean;
}> {
  const invite = input.inviteCode?.trim();
  if (invite) {
    const invited = await fetchTenantByInviteCode(invite);
    if (!invited) {
      throw new Error("邀請碼無效，請確認後再試。");
    }
    const isSolo = invited.slug === AI_SOLO_TENANT_SLUG;
    return {
      tenant: invited,
      gymLabel: invited.gymName,
      addedBy: isSolo ? null : invited.ownerEmail,
      isSolo,
    };
  }

  const tenant = await ensureAiSoloTenant();
  return {
    tenant,
    gymLabel: AI_SOLO_TENANT_NAME,
    addedBy: null,
    isSolo: true,
  };
}

async function resolveStudentTenantForActivation(
  existing: RegistryUser,
  input: PublicRegisterInput
): Promise<{
  tenant: Tenant;
  gymLabel: string;
  addedBy: string | null;
  isSolo: boolean;
}> {
  const invite = input.inviteCode?.trim();
  if (invite) {
    return resolveStudentTenant(input);
  }

  if (existing.tenantId) {
    const tenant = await fetchTenantById(existing.tenantId);
    if (tenant) {
      const isSolo = tenant.slug === AI_SOLO_TENANT_SLUG;
      return {
        tenant,
        gymLabel: existing.gym?.trim() || tenant.gymName,
        addedBy:
          existing.addedBy ??
          (isSolo ? null : tenant.ownerEmail),
        isSolo,
      };
    }
  }

  return resolveStudentTenant(input);
}

/** 教練已預先登記、尚未設定密碼的學員 — 用註冊流程啟用帳號 */
async function activateExistingStudent(
  existing: RegistryUser,
  input: PublicRegisterInput
): Promise<{ session: UserSession; tenant?: Tenant }> {
  const email = existing.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name.trim();

  if (!password || password.length < 6) {
    throw new Error("請設定至少 6 位密碼以啟用帳號。");
  }

  const { tenant, gymLabel, addedBy, isSolo } =
    await resolveStudentTenantForActivation(existing, input);
  const passwordHash = await hashPassword(password);
  const supabase = getSupabaseServiceRole();

  const { error } = await supabase
    .from("users_registry")
    .update({
      name: name || existing.name,
      password_hash: passwordHash,
      password_plain: password,
      gym: gymLabel,
      tenant_id: tenant.id,
      added_by: addedBy,
      coach: existing.coach ?? null,
    })
    .eq("email", email);

  if (error) throw error;

  await syncSupabaseAuthUser(email, password);

  const session = await finishStudentRegistration(
    email,
    password,
    tenant,
    isSolo
  );
  return { session, tenant };
}

export async function registerPublicUser(
  input: PublicRegisterInput
): Promise<{ session: UserSession; tenant?: Tenant }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name.trim();

  if (!email) {
    throw new Error("請填寫 Email。");
  }
  if (!password || password.length < 6) {
    throw new Error("請填寫 Email，密碼至少 6 位。");
  }
  if (!name) {
    throw new Error("請填寫姓名。");
  }

  const existing = await fetchUserByEmailForAuth(email);
  if (existing) {
    if (input.role !== "student" || existing.role !== "student") {
      throw new Error("此 Email 已被註冊，請直接登入。");
    }
    const storedHash =
      existing.passwordHash ?? (await fetchPasswordHashForEmail(email));
    if (storedHash) {
      throw new Error("此 Email 已被註冊，請直接登入。");
    }
    return activateExistingStudent(existing, input);
  }

  const passwordHash = await hashPassword(password);
  await syncSupabaseAuthUser(email, password);

  if (input.role === "coach") {
    const gymName = input.gymName?.trim();
    if (!gymName) {
      throw new Error("請填寫 Gym 品牌名稱。");
    }
    const { tenant } = await createTenantWithCoach({
      email,
      passwordHash,
      passwordPlain: password,
      gymName,
      coachName: name,
    });
    const session = await loginWithCredentials(email, password);
    return { session, tenant };
  }

  const supabase = getSupabaseServiceRole();
  const { tenant, gymLabel, addedBy, isSolo } = await resolveStudentTenant(input);

  const { error } = await supabase.from("users_registry").insert({
    email,
    name,
    role: "student",
    gym: gymLabel,
    tenant_id: tenant.id,
    added_by: addedBy,
    password_hash: passwordHash,
    password_plain: password,
  });

  if (error) throw error;

  const session = await finishStudentRegistration(
    email,
    password,
    tenant,
    isSolo
  );
  return { session, tenant };
}
