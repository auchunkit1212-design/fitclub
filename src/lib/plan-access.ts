import { getSession } from "@/lib/session";
import { resolveIsPro } from "@/lib/user-plan";
import type { UserSession } from "@/lib/types";

/** Client-side: uses session.isPro synced from /api/me/plan (includes coach inheritance). */
export function hasProAccessFromSession(session?: UserSession | null): boolean {
  const s = session ?? getSession();
  if (!s?.email) return false;
  return resolveIsPro({
    email: s.email,
    role: s.role,
    plan: s.plan,
    isPro: s.isPro,
  });
}
