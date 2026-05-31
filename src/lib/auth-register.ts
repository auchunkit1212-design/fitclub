import { emailExists } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  AI_SOLO_TENANT_NAME,
  AI_SOLO_TENANT_SLUG,
} from "@/lib/registry-constants";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  createTenantWithCoach,
  ensureAiSoloTenant,
  fetchTenantBySlug,
} from "@/lib/tenant";
import type { Tenant, UserSession } from "@/lib/types";
import { loginWithCredentials } from "@/lib/auth";

export type PublicRegisterRole = "coach" | "student";

export interface PublicRegisterInput {
  role: PublicRegisterRole;
  email: string;
  password: string;
  name: string;
  gymName?: string;
  inviteCode?: string;
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

export async function registerPublicUser(
  input: PublicRegisterInput
): Promise<{ session: UserSession; tenant?: Tenant }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name.trim();

  if (!email || !password || password.length < 6) {
    throw new Error("請填寫 Email，密碼至少 6 位。");
  }
  if (!name) {
    throw new Error("請填寫姓名。");
  }
  if (await emailExists(email)) {
    throw new Error("此 Email 已被註冊，請直接登入。");
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
      gymName,
      coachName: name,
    });
    const session = await loginWithCredentials(email, password);
    return { session, tenant };
  }

  const supabase = getSupabaseAdmin();
  let tenant: Tenant;
  let gymLabel = AI_SOLO_TENANT_NAME;
  const invite = input.inviteCode?.trim();

  if (invite) {
    const invited = await fetchTenantBySlug(invite);
    if (!invited) {
      throw new Error("邀請碼無效，請確認後再試。");
    }
    tenant = invited;
    gymLabel = invited.gymName;
  } else {
    tenant = await ensureAiSoloTenant();
  }

  const isSolo = tenant.slug === AI_SOLO_TENANT_SLUG;

  const { error } = await supabase.from("users_registry").insert({
    email,
    name,
    role: "student",
    gym: gymLabel,
    tenant_id: tenant.id,
    added_by: isSolo ? null : tenant.ownerEmail,
    password_hash: passwordHash,
  });

  if (error) throw error;

  const session = await loginWithCredentials(email, password);
  return {
    session: {
      ...session,
      isSoloStudent: isSolo,
      tenantSlug: tenant.slug,
    },
    tenant,
  };
}
