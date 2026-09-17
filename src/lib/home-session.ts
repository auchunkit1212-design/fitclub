import type { CoachBranding, UserSession } from "@/lib/types";
import { DEFAULT_BRANDING } from "@/lib/types";

export function normalizeHomeSession(
  parsed: UserSession,
  fallbacks: { trialStudent: string; unboundGym: string }
): UserSession {
  const role =
    parsed.role === "coach" || parsed.role === "admin"
      ? parsed.role
      : "student";
  return {
    ...parsed,
    role,
    name: parsed.name || fallbacks.trialStudent,
    email: parsed.email || "",
    gym: parsed.gym || fallbacks.unboundGym,
    isLoggedIn: true,
  };
}

export function brandingFromSession(session: UserSession): CoachBranding {
  return {
    appTitle: session.brandName ?? session.gym ?? DEFAULT_BRANDING.appTitle,
    themeColor: "emerald",
    logo: session.brandLogo,
  };
}
