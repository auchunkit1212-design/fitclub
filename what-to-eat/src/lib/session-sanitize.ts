import type { UserSession } from "@/lib/types";

export function sanitizeSessionForApi(session: UserSession): UserSession {
  return { ...session };
}
