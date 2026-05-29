import type { UserSession } from "@/lib/types";

const SESSION_KEY = "current_session";

export function parseSessionFromRequest(
  request: Request
): UserSession | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${SESSION_KEY}=([^;]*)`)
  );
  if (!match?.[1]) return null;

  try {
    return JSON.parse(decodeURIComponent(match[1])) as UserSession;
  } catch {
    return null;
  }
}
