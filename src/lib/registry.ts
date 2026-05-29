import type { RegistryUser, UserSession } from "./types";

export const SUPER_ADMIN_EMAIL = "auchunkit1212@gmail.com";

const DEFAULT_REGISTRY: RegistryUser[] = [
  {
    email: "owner@gmail.com",
    name: "旺角店-張老闆",
    role: "coach",
    gym: "FitClub 旺角店",
    addedBy: SUPER_ADMIN_EMAIL,
  },
  {
    email: "student@gmail.com",
    name: "陳大文",
    role: "student",
    gym: "FitClub 旺角店",
    coach: "旺角店-張老闆",
    addedBy: "owner@gmail.com",
  },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function initUserRegistry(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("user_registry")) {
    localStorage.setItem("user_registry", JSON.stringify(DEFAULT_REGISTRY));
  }
}

export function getUserRegistry(): RegistryUser[] {
  if (typeof window === "undefined") return DEFAULT_REGISTRY;
  return safeParse(localStorage.getItem("user_registry"), DEFAULT_REGISTRY);
}

export function saveUserRegistry(users: RegistryUser[]): void {
  localStorage.setItem("user_registry", JSON.stringify(users));
}

export function findRegistryUser(email: string): RegistryUser | undefined {
  const normalized = email.trim().toLowerCase();
  return getUserRegistry().find((user) => user.email.toLowerCase() === normalized);
}

export function emailExists(email: string): boolean {
  return Boolean(findRegistryUser(email));
}

export function registryUserToSession(user: RegistryUser): UserSession {
  return {
    role: user.role,
    name: user.name,
    email: user.email,
    gym: user.gym,
    coach: user.coach,
    addedBy: user.addedBy,
    isLoggedIn: true,
  };
}

export function createAdminSession(email: string): UserSession {
  return {
    role: "admin",
    name: "最高總裁 (Kit Au)",
    email: email.trim().toLowerCase(),
    gym: "全港連鎖總部",
    isLoggedIn: true,
  };
}
