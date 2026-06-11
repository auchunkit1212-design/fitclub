import { applyUserPlanToSession } from "@/lib/user-plan";
import { getSession, getSessionRequestHeaders, saveSession } from "@/lib/session";
import type { UserPlan, UserSession } from "@/lib/types";

export async function syncSessionPlan(): Promise<UserSession | null> {
  const session = getSession();
  if (!session?.email) return null;

  try {
    const res = await fetch(`/api/me/plan?_=${Date.now()}`, {
      credentials: "include",
      cache: "no-store",
      headers: getSessionRequestHeaders(),
    });
    if (!res.ok) return session;
    const data = (await res.json()) as { plan?: UserPlan; isPro?: boolean };
    const next = {
      ...session,
      plan: data.plan ?? session.plan,
      isPro: data.isPro === true,
    };
    saveSession(next);
    if (
      next.plan !== session.plan ||
      next.isPro !== session.isPro
    ) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fitclub:plan-synced"));
      }
    }
    return next;
  } catch {
    return applyUserPlanToSession(session);
  }
}
