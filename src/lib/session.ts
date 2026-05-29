import type { UserSession } from "@/lib/types";

const SESSION_KEY = "current_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookieSession(): UserSession | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SESSION_KEY}=([^;]*)`)
  );
  if (!match?.[1]) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as UserSession;
  } catch {
    return null;
  }
}

export function getSession(): UserSession | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as UserSession;
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  return readCookieSession();
}

export function saveSession(session: UserSession): void {
  const json = JSON.stringify(session);
  localStorage.setItem(SESSION_KEY, json);
  document.cookie = `${SESSION_KEY}=${encodeURIComponent(json)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  document.cookie = `${SESSION_KEY}=;path=/;max-age=0;SameSite=Lax`;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}
