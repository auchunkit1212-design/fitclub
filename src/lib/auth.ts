import { applyBrandToSession, resolveBrandForLogin } from "@/lib/branding";
import {
  createAdminSession,
  fetchPasswordHashForEmail,
  fetchUserByEmailForAuth,
  registryUserToSession,
} from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import { backfillCoachStudentTenants, fetchTenantById } from "@/lib/tenant";
import { isAiSoloTenantSlug } from "@/lib/ai-solo-coach";
import { applyUserPlanToSession } from "@/lib/user-plan";
import type { RegistryUser, UserSession } from "@/lib/types";

export async function enrichSession(
  session: UserSession,
  user: RegistryUser
): Promise<UserSession> {
  try {
    const brand = await resolveBrandForLogin(session, user);
    session = applyBrandToSession(session, brand);
  } catch (err) {
    console.warn("[auth] branding resolution skipped:", err);
  }

  if (user.tenantId) {
    try {
      const tenant = await fetchTenantById(user.tenantId);
      session.tenantSlug = tenant?.slug ?? session.tenantSlug;
      session.tenantId = user.tenantId;
      session.isSoloStudent = isAiSoloTenantSlug(tenant?.slug);

      if (user.role === "coach" && user.name) {
        void backfillCoachStudentTenants({
          coachEmail: user.email,
          coachName: user.name,
          tenantId: user.tenantId,
        }).catch((err) => {
          console.warn("[auth] tenant backfill skipped:", err);
        });
      }
    } catch (err) {
      console.warn("[auth] tenant lookup skipped:", err);
    }
  } else if (user.role === "student" && !user.coach && !user.addedBy) {
    session.isSoloStudent = true;
  }

  return applyUserPlanToSession(session, user);
}

export async function loginWithCredentials(
  email: string,
  password?: string
): Promise<UserSession> {
  const normalized = email.trim().toLowerCase();
  const plainPassword = password?.trim() || undefined;

  if (normalized === SUPER_ADMIN_EMAIL) {
    return createAdminSession(normalized);
  }

  const user = await fetchUserByEmailForAuth(normalized);
  if (!user) {
    throw new Error("此 Email 尚未獲授權，請聯絡教練或老闆登記。");
  }

  let passwordHash = user.passwordHash;
  if (!passwordHash && plainPassword) {
    try {
      passwordHash = (await fetchPasswordHashForEmail(normalized)) ?? undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        throw new Error(
          "伺服器未設定 SUPABASE_SERVICE_ROLE_KEY，無法驗證密碼，請聯絡管理員。"
        );
      }
      throw err;
    }
  }

  if (passwordHash) {
    if (!plainPassword) {
      throw new Error("此帳號已設定密碼，請輸入密碼登入。");
    }
    const ok = await verifyPassword(plainPassword, passwordHash);
    if (!ok) {
      throw new Error("密碼錯誤，請再試一次。");
    }
  } else if (plainPassword) {
    throw new Error(
      "此帳號尚未設定密碼。請到「註冊」分頁重新設定密碼（若已用邀請連結，請切換到註冊並填寫相同 Email）。"
    );
  }

  let session = registryUserToSession(user);
  session = await enrichSession(session, user);
  return session;
}

/** 舊版無密碼學員／教練的 client 端後備登入（API 不可用時） */
export async function buildSessionFromRegistryUser(
  user: RegistryUser
): Promise<UserSession> {
  let session = registryUserToSession(user);
  session = await enrichSession(session, user);
  return session;
}
