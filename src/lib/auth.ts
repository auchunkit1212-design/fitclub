import { applyBrandToSession, resolveBrandForUser } from "@/lib/branding";
import {
  createAdminSession,
  fetchUserByEmail,
  fetchUsersForSession,
  registryUserToSession,
} from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import type { UserSession } from "@/lib/types";

export async function loginWithCredentials(
  email: string,
  password?: string
): Promise<UserSession> {
  const normalized = email.trim().toLowerCase();

  if (normalized === SUPER_ADMIN_EMAIL) {
    return createAdminSession(normalized);
  }

  const user = await fetchUserByEmail(normalized, { includePasswordHash: true });
  if (!user) {
    throw new Error("此 Email 尚未獲授權，請聯絡教練或老闆登記。");
  }

  if (user.passwordHash) {
    if (!password?.trim()) {
      throw new Error("請輸入密碼登入。");
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new Error("密碼錯誤，請再試一次。");
    }
  }

  let session = registryUserToSession(user);
  const registry = await fetchUsersForSession(session);
  const brand = await resolveBrandForUser(session, registry);
  session = applyBrandToSession(session, brand);
  session.tenantSlug = brand.tenantSlug;
  return session;
}
