import { applyUserPlanToSession } from "@/lib/user-plan";
import { getSession, getSessionRequestHeaders, saveSession } from "@/lib/session";
import type { UserPlan, UserSession } from "@/lib/types";

export async function syncSessionPlan(): Promise<UserSession | null> {
  const session = getSession();
  if (!session?.email) return null;

  try {
    const res = await fetch("/api/me/plan", {
      credentials: "include",
      headers: getSessionRequestHeaders(),
    });
    if (!res.ok) return session;
    const data = (await res.json()) as { plan?: UserPlan; isPro?: boolean };
    const next = applyUserPlanToSession({
      ...session,
      plan: data.plan ?? session.plan,
      isPro: data.isPro ?? session.isPro,
    });
    saveSession(next);
    return next;
  } catch {
    return applyUserPlanToSession(session);
  }
}
