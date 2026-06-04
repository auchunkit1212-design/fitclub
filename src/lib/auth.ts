import { applyBrandToSession, resolveBrandForUser } from "@/lib/branding";
import {
  createAdminSession,
  fetchUserByEmailForAuth,
  fetchUsersForSession,
  registryUserToSession,
} from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import { backfillCoachStudentTenants, fetchTenantById } from "@/lib/tenant";
import { isAiSoloTenantSlug } from "@/lib/ai-solo-coach";
import { applyUserPlanToSession } from "@/lib/user-plan";
import type { RegistryUser, UserSession } from "@/lib/types";

async function enrichSession(
  session: UserSession,
  user: RegistryUser
): Promise<UserSession> {
  try {
    const registry = await fetchUsersForSession(session);
    const brand = await resolveBrandForUser(session, registry);
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
        await backfillCoachStudentTenants({
          coachEmail: user.email,
          coachName: user.name,
          tenantId: user.tenantId,
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

  if (user.passwordHash) {
    if (!plainPassword) {
      throw new Error("此帳號已設定密碼，請輸入密碼登入。");
    }
    const ok = await verifyPassword(plainPassword, user.passwordHash);
    if (!ok) {
      throw new Error("密碼錯誤，請再試一次。");
    }
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
