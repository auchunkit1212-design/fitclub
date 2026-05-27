import {
  CoachBranding,
  DEFAULT_BRANDING,
  DEFAULT_PROFILE,
  MealLog,
  UserProfile,
} from "./types";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getUserProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  return safeParse(localStorage.getItem("user_profile"), DEFAULT_PROFILE);
}

export function getCoachBranding(): CoachBranding {
  if (typeof window === "undefined") return DEFAULT_BRANDING;
  return safeParse(localStorage.getItem("coach_branding"), DEFAULT_BRANDING);
}

export function getCoachBroadcast(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("coach_broadcast") ?? "";
}

export function getMealLogs(): MealLog[] {
  if (typeof window === "undefined") return [];
  return safeParse<MealLog[]>(localStorage.getItem("meal_logs"), []);
}

export function saveMealLogs(logs: MealLog[]): void {
  localStorage.setItem("meal_logs", JSON.stringify(logs));
}

export function saveCoachBranding(branding: CoachBranding): void {
  localStorage.setItem("coach_branding", JSON.stringify(branding));
}

export function saveCoachBroadcast(message: string): void {
  localStorage.setItem("coach_broadcast", message);
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

export function getThemeClasses(color: CoachBranding["themeColor"]) {
  const map = {
    emerald: {
      header: "bg-emerald-600",
      accent: "text-emerald-600",
      bar: "bg-emerald-500",
      ring: "ring-emerald-500",
      btn: "bg-emerald-600 hover:bg-emerald-700",
    },
    blue: {
      header: "bg-blue-600",
      accent: "text-blue-600",
      bar: "bg-blue-500",
      ring: "ring-blue-500",
      btn: "bg-blue-600 hover:bg-blue-700",
    },
    black: {
      header: "bg-zinc-900",
      accent: "text-zinc-900",
      bar: "bg-zinc-800",
      ring: "ring-zinc-700",
      btn: "bg-zinc-900 hover:bg-zinc-800",
    },
  };
  return map[color];
}
