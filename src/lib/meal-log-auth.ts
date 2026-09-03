import { fetchUserByEmail } from "@/lib/db";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import type { UserSession } from "@/lib/types";

const SUPER_ADMIN = SUPER_ADMIN_EMAIL.trim().toLowerCase();

function isPlatformAdmin(session: UserSession | null, email: string): boolean {
  return session?.role === "admin" || email === SUPER_ADMIN;
}

/** Session header/cookie 或 body email；總裁帳戶無 users_registry 列亦可記錄飲食 */
export async function resolveMealLogEmail(
  session: UserSession | null,
  bodyEmail?: string
): Promise<string | null> {
  const fromSession = session?.email?.trim().toLowerCase();
  if (fromSession) {
    if (isPlatformAdmin(session, fromSession)) return fromSession;
    const user = await fetchUserByEmail(fromSession);
    if (user) return fromSession;
  }

  const candidate = bodyEmail?.trim().toLowerCase();
  if (candidate) {
    if (candidate === SUPER_ADMIN) return candidate;
    const user = await fetchUserByEmail(candidate);
    if (user) return candidate;
  }

  return null;
}
