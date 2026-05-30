import { fetchUserByEmail } from "@/lib/db";
import type { UserSession } from "@/lib/types";

/** Session header/cookie 或 body email（須存在 users_registry） */
export async function resolveMealLogEmail(
  session: UserSession | null,
  bodyEmail?: string
): Promise<string | null> {
  const fromSession = session?.email?.trim().toLowerCase();
  if (fromSession) {
    const user = await fetchUserByEmail(fromSession);
    if (user) return fromSession;
  }

  const candidate = bodyEmail?.trim().toLowerCase();
  if (candidate) {
    const user = await fetchUserByEmail(candidate);
    if (user) return candidate;
  }

  return null;
}
