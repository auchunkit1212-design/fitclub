import {
  fetchMealLogs,
  fetchMealLogsForSession,
  insertMealLog,
  resolveBranding,
  updateCoachBranding,
} from "@/lib/db";
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

export async function saveMealLog(
  log: Omit<MealLog, "id" | "createdAt" | "date"> & { email: string }
): Promise<MealLog> {
  return insertMealLog(log);
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
      header: "bg-emerald-600",
      accent: "text-emerald-600",
      btn: "bg-emerald-600",
      text: "text-emerald-600",
      ring: "ring-emerald-500",
      bar: "bg-emerald-500",
    },
    blue: {
      header: "bg-blue-600",
      accent: "text-blue-600",
      btn: "bg-blue-600",
      text: "text-blue-600",
      ring: "ring-blue-500",
      bar: "bg-blue-500",
    },
    black: {
      header: "bg-zinc-900",
      accent: "text-zinc-800",
      btn: "bg-zinc-900",
      text: "text-zinc-800",
      ring: "ring-zinc-700",
      bar: "bg-zinc-800",
    },
  } as const;
  return map[theme] ?? map.emerald;
}

export { DEFAULT_BRANDING };
