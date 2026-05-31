import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import type { RegistryUser } from "@/lib/types";

const DEMO_USERS: RegistryUser[] = [
  {
    email: "owner@gmail.com",
    name: "旺角店-張老闆",
    role: "coach",
    gym: "旺角體驗店",
    addedBy: SUPER_ADMIN_EMAIL,
    appTitle: "旺角體驗店",
    themeColor: "emerald",
  },
  {
    email: "student@gmail.com",
    name: "陳大文",
    role: "student",
    gym: "旺角體驗店",
    coach: "旺角店-張老闆",
    addedBy: "owner@gmail.com",
  },
];

export function getDemoUser(email: string): RegistryUser | null {
  const normalized = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email === normalized) ?? null;
}

export function getDemoRegistry(): RegistryUser[] {
  return DEMO_USERS;
}
