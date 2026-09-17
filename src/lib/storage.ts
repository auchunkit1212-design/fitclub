import {
  fetchMealLogs,
  fetchMealLogsForSession,
  fetchOwnMealLogsForSession,
  insertMealLog,
  resolveBranding,
  updateCoachBranding,
} from "@/lib/db";
import { getSessionRequestHeaders } from "@/lib/session";
import { DEFAULT_BRANDING, DEFAULT_PROFILE } from "@/lib/types";
import type {
  CoachBranding,
  MealLog,
  RegistryUser,
  ThemeColor,
  UserSession,
} from "@/lib/types";

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // randomUUID needs secure context (HTTPS / localhost)
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getUserProfile() {
  return DEFAULT_PROFILE;
}

export async function getCoachBranding(
  session: UserSession,
  registry: RegistryUser[]
): Promise<CoachBranding> {
  const resolved = await resolveBranding(session, registry);
  return resolved.branding;
}

export async function getCoachBroadcast(
  session: UserSession,
  registry: RegistryUser[]
): Promise<string> {
  const resolved = await resolveBranding(session, registry);
  return resolved.broadcast;
}

export async function getMealLogs(
  session: UserSession,
  registry: RegistryUser[]
): Promise<MealLog[]> {
  return fetchMealLogsForSession(session, registry);
}

export async function getOwnMealLogs(
  session: UserSession,
  filters?: { from?: string; to?: string }
): Promise<MealLog[]> {
  return fetchOwnMealLogsForSession(session, filters);
}

export async function notifyCoachAfterMealLog(log: MealLog): Promise<void> {
  try {
    await fetch("/api/meals/notify-coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getSessionRequestHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ log }),
    });
  } catch (err) {
    console.warn("[saveMealLog] coach notify failed:", err);
  }
}

export async function saveMealLog(
  log: Omit<MealLog, "id" | "createdAt" | "date"> & { email: string },
  options?: { notifyCoach?: boolean }
): Promise<MealLog> {
  const saved = await insertMealLog(log);
  if (options?.notifyCoach) {
    void notifyCoachAfterMealLog(saved);
  }
  return saved;
}

export async function saveCoachBranding(
  coachEmail: string,
  branding: CoachBranding,
  broadcast: string
): Promise<void> {
  await updateCoachBranding(coachEmail, {
    appTitle: branding.appTitle,
    themeColor: branding.themeColor,
    logo: branding.logo,
    broadcast,
  });
}

export async function getMealLogsByEmails(emails: string[]): Promise<MealLog[]> {
  return fetchMealLogs({ emails });
}

export function isToday(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function getThemeClasses(theme: ThemeColor) {
  const map = {
    emerald: {
      header: "",
      accent: "text-emerald-600",
      btn: "bg-emerald-600 hover:bg-emerald-700",
      text: "text-emerald-700",
      ring: "ring-emerald-600",
      bar: "bg-emerald-600",
    },
    blue: {
      header: "",
      accent: "text-emerald-600",
      btn: "bg-emerald-600 hover:bg-emerald-700",
      text: "text-emerald-700",
      ring: "ring-emerald-600",
      bar: "bg-emerald-600",
    },
    black: {
      header: "",
      accent: "text-emerald-600",
      btn: "bg-emerald-600 hover:bg-emerald-700",
      text: "text-emerald-700",
      ring: "ring-emerald-600",
      bar: "bg-emerald-600",
    },
  } as const;
  return map[theme] ?? map.emerald;
}

export { DEFAULT_BRANDING };
