import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import type { RegistryUser } from "@/lib/types";

/** 雲端未就緒時，允許測試帳號本地登入（唔會寫入 Supabase） */
const DEMO_USERS: RegistryUser[] = [
  {
    email: "owner@gmail.com",
    name: "旺角店-張老闆",
    role: "coach",
    gym: "FitClub 旺角店",
    addedBy: SUPER_ADMIN_EMAIL,
    appTitle: "fitclub.hk 連鎖管理",
    themeColor: "emerald",
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

export function getDemoUser(email: string): RegistryUser | null {
  const normalized = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email === normalized) ?? null;
}

export function getDemoRegistry(): RegistryUser[] {
  return DEMO_USERS;
}
