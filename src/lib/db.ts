import { supabase } from "@/lib/supabase";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import type {
  CoachBranding,
  MealLog,
  RegistryUser,
  ThemeColor,
  UserSession,
} from "@/lib/types";
import { DEFAULT_BRANDING } from "@/lib/types";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "student" | "coach";
  gym: string | null;
  coach: string | null;
  logo: string | null;
  added_by: string | null;
  app_title: string | null;
  theme_color: string | null;
  broadcast: string | null;
  created_at: string;
};

type MealRow = {
  id: string;
  email: string;
  meal_type: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  image_base64: string | null;
  created_at: string;
};

function mapUser(row: UserRow): RegistryUser {
  return {
    email: row.email,
    name: row.name,
    role: row.role,
    gym: row.gym ?? "",
    coach: row.coach ?? undefined,
    addedBy: row.added_by ?? undefined,
    logo: row.logo ?? undefined,
    appTitle: row.app_title ?? undefined,
    themeColor: (row.theme_color as ThemeColor) ?? undefined,
    broadcast: row.broadcast ?? undefined,
  };
}

function mapMeal(row: MealRow): MealLog {
  return {
    id: row.id,
    email: row.email,
    date: row.created_at,
    mealType: row.meal_type,
    description: row.description,
    imageBase64: row.image_base64 ?? undefined,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fats: row.fats,
    createdAt: row.created_at,
  };
}

export async function ensureSeedData(): Promise<void> {
  const { count, error } = await supabase
    .from("users_registry")
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  if ((count ?? 0) > 0) return;

  const { error: seedError } = await supabase.from("users_registry").insert([
    {
      email: "owner@gmail.com",
      name: "旺角店-張老闆",
      role: "coach",
      gym: "FitClub 旺角店",
      added_by: SUPER_ADMIN_EMAIL,
      app_title: "fitclub.hk 連鎖管理",
      theme_color: "emerald",
    },
    {
      email: "student@gmail.com",
      name: "陳大文",
      role: "student",
      gym: "FitClub 旺角店",
      coach: "旺角店-張老闆",
      added_by: "owner@gmail.com",
    },
  ]);

  if (seedError) throw seedError;
}

export async function fetchUserByEmail(
  email: string
): Promise<RegistryUser | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("users_registry")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();

  if (error) throw error;
  return data ? mapUser(data as UserRow) : null;
}

export async function fetchAllUsers(): Promise<RegistryUser[]> {
  const { data, error } = await supabase
    .from("users_registry")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as UserRow[]).map(mapUser);
}

export async function emailExists(email: string): Promise<boolean> {
  const user = await fetchUserByEmail(email);
  return Boolean(user);
}

export async function insertUser(
  user: Omit<RegistryUser, "logo" | "appTitle" | "themeColor" | "broadcast">
): Promise<void> {
  const { error } = await supabase.from("users_registry").insert({
    email: user.email.trim().toLowerCase(),
    name: user.name,
    role: user.role,
    gym: user.gym,
    coach: user.coach ?? null,
    added_by: user.addedBy ?? null,
    app_title: user.role === "coach" ? "fitclub.hk 健康管理" : null,
    theme_color: user.role === "coach" ? "emerald" : null,
  });

  if (error) throw error;
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

export async function fetchMealLogs(options?: {
  emails?: string[];
}): Promise<MealLog[]> {
  let query = supabase
    .from("meal_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.emails && options.emails.length > 0) {
    query = query.in("email", options.emails.map((e) => e.toLowerCase()));
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as MealRow[]).map(mapMeal);
}

export async function insertMealLog(
  log: Omit<MealLog, "id" | "createdAt" | "date"> & { email: string }
): Promise<MealLog> {
  const { data, error } = await supabase
    .from("meal_logs")
    .insert({
      email: log.email.trim().toLowerCase(),
      meal_type: log.mealType,
      description: log.description,
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbs,
      fats: log.fats,
      image_base64: log.imageBase64 ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapMeal(data as MealRow);
}

export async function fetchMealLogsForSession(
  session: UserSession,
  registry: RegistryUser[]
): Promise<MealLog[]> {
  if (session.role === "admin") {
    return fetchMealLogs();
  }

  if (session.role === "coach") {
    const studentEmails = registry
      .filter((u) => u.role === "student" && u.addedBy === session.email)
      .map((u) => u.email);
    if (studentEmails.length === 0) return [];
    return fetchMealLogs({ emails: studentEmails });
  }

  return fetchMealLogs({ emails: [session.email] });
}

export async function resolveBranding(
  session: UserSession,
  registry: RegistryUser[]
): Promise<{ branding: CoachBranding; broadcast: string }> {
  let coachRow: RegistryUser | undefined;

  if (session.role === "coach") {
    coachRow = registry.find((u) => u.email === session.email);
  } else if (session.role === "student" && session.coach) {
    coachRow = registry.find(
      (u) => u.role === "coach" && u.name === session.coach
    );
  } else {
    coachRow = registry.find((u) => u.role === "coach");
  }

  if (!coachRow) {
    return { branding: DEFAULT_BRANDING, broadcast: "" };
  }

  return {
    branding: {
      appTitle: coachRow.appTitle ?? DEFAULT_BRANDING.appTitle,
      themeColor: coachRow.themeColor ?? DEFAULT_BRANDING.themeColor,
      logo: coachRow.logo,
    },
    broadcast: coachRow.broadcast ?? "",
  };
}

export async function updateCoachBranding(
  coachEmail: string,
  payload: {
    appTitle: string;
    themeColor: ThemeColor;
    logo?: string;
    broadcast: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from("users_registry")
    .update({
      app_title: payload.appTitle,
      theme_color: payload.themeColor,
      logo: payload.logo ?? null,
      broadcast: payload.broadcast,
    })
    .eq("email", coachEmail.trim().toLowerCase())
    .eq("role", "coach");

  if (error) throw error;
}

export async function updateCoachLogo(
  coachEmail: string,
  logo: string
): Promise<void> {
  const { error } = await supabase
    .from("users_registry")
    .update({ logo })
    .eq("email", coachEmail.trim().toLowerCase())
    .eq("role", "coach");

  if (error) throw error;
}
