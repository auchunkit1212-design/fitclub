import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import {
  fetchPasswordHashForEmail,
  fetchUserByEmailForAuth,
  registryUserToSession,
} from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { applyEffectivePlanToSession } from "@/lib/user-plan";
import type { RegistryUser, UserSession } from "@/lib/types";

export async function enrichSession(
  session: UserSession,
  user: RegistryUser
): Promise<UserSession> {
  return applyEffectivePlanToSession(session, user);
}

export async function loginWithCredentials(
  email: string,
  password?: string
): Promise<UserSession> {
  const normalized = email.trim().toLowerCase();
  const plainPassword = password?.trim() || undefined;

  if (normalized === SUPER_ADMIN_EMAIL && !plainPassword) {
    // Admin still needs password if set; fall through to registry
  }

  const user = await fetchUserByEmailForAuth(normalized);
  if (!user) {
    throw new Error(
      "此 Email 尚未登記。請先用 Nutrition Coach 主 app 註冊／請教練開通帳號。"
    );
  }

  let passwordHash = user.passwordHash;
  if (!passwordHash && plainPassword) {
    try {
      passwordHash = (await fetchPasswordHashForEmail(normalized)) ?? undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        throw new Error(
          "伺服器未設定 SUPABASE_SERVICE_ROLE_KEY，無法驗證密碼。"
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
      "此帳號尚未設定密碼。請到 Nutrition Coach 主 app 完成註冊設定密碼。"
    );
  }

  let session = registryUserToSession(user);
  session = await enrichSession(session, user);
  return session;
}
