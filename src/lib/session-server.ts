import type { UserSession } from "@/lib/types";

const SESSION_KEY = "current_session";

function readCookieValue(cookieHeader: string, key: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return match?.[1] ?? null;
}

export function hasSessionCookie(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return false;
  return Boolean(readCookieValue(cookieHeader, SESSION_KEY));
}

export function parseSessionFromRequest(
  request: Request
): UserSession | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const raw = readCookieValue(cookieHeader, SESSION_KEY);
  if (!raw) return null;

  const attempts = [raw, decodeURIComponent(raw)];
  for (const candidate of attempts) {
    try {
      const session = JSON.parse(candidate) as UserSession;
      if (session?.email) return session;
    } catch {
      // try next parse strategy
    }
  }
  return null;
}
