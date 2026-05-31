import { resolveBrandForUser } from "@/lib/branding";
import { syncTenantBranding } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { toReadableError } from "@/lib/errors";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import type {
  CoachBranding,
  MealLog,
  RegistryUser,
  StudentBodyProfile,
  StudentGender,
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
  tenant_id: string | null;
  password_hash: string | null;
  created_at: string;
};

type MealRow = {
  id: string;
  email: string;
  meal_type: string;
  description: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  image_base64?: string | null;
  image_url?: string | null;
  created_at: string;
};

function mapUser(row: UserRow, includePasswordHash = false): RegistryUser {
  const user: RegistryUser = {
    email: row.email,
    name: row.name,
    role: row.role,
    gym: row.gym ?? "",
    coach: row.coach ?? undefined,
    addedBy: row.added_by ?? undefined,
    tenantId: row.tenant_id ?? undefined,
    logo: row.logo ?? undefined,
    appTitle: row.app_title ?? undefined,
    themeColor: (row.theme_color as ThemeColor) ?? undefined,
    broadcast: row.broadcast ?? undefined,
    hasPassword: Boolean(row.password_hash),
  };
  if (includePasswordHash && row.password_hash) {
    user.passwordHash = row.password_hash;
  }
  return user;
}

async function attachTenantNames(users: RegistryUser[]): Promise<RegistryUser[]> {
  const tenantIds = users
    .map((u) => u.tenantId)
    .filter((id): id is string => Boolean(id));
  if (tenantIds.length === 0) return users;

  try {
    const unique = Array.from(new Set(tenantIds));
    const { data, error } = await supabase
      .from("tenants")
      .select("id, gym_name")
      .in("id", unique);
    if (error) throw error;
    const names = new Map(
      (data ?? []).map((row) => [String(row.id), String(row.gym_name)])
    );
    return users.map((u) => ({
      ...u,
      tenantName: u.tenantId ? names.get(u.tenantId) ?? u.appTitle ?? u.gym : undefined,
    }));
  } catch (err) {
    console.warn("[db] fetch tenant names failed", err);
    return users;
  }
}

function mapMeal(row: MealRow): MealLog {
  return {
    id: row.id,
    email: row.email,
    date: row.created_at,
    mealType: row.meal_type,
    description: row.description,
    imageBase64: row.image_base64 ?? undefined,
    imageUrl: row.image_url ?? undefined,
    calories: row.calories,
    protein: row.protein ?? 0,
    carbs: row.carbs ?? 0,
    fats: row.fats ?? 0,
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
      gym: "旺角體驗店",
      added_by: SUPER_ADMIN_EMAIL,
      app_title: "旺角體驗店",
      theme_color: "emerald",
    },
    {
      email: "student@gmail.com",
      name: "陳大文",
      role: "student",
      gym: "旺角體驗店",
      coach: "旺角店-張老闆",
      added_by: "owner@gmail.com",
    },
  ]);

  if (seedError) {
    console.warn("[seed] 種子資料寫入失敗:", seedError.message);
  }
}

export async function fetchUserByEmail(
  email: string,
  options?: { includePasswordHash?: boolean }
): Promise<RegistryUser | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("users_registry")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapUser(data as UserRow, options?.includePasswordHash);

  const { getDemoUser } = await import("@/lib/demo-users");
  return getDemoUser(normalized);
}

export async function fetchAllUsers(): Promise<RegistryUser[]> {
  const { data, error } = await supabase
    .from("users_registry")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data as UserRow[]).map((row) => mapUser(row));
  if (rows.length > 0) return attachTenantNames(rows);

  const { getDemoRegistry } = await import("@/lib/demo-users");
  return getDemoRegistry();
}

export async function fetchUsersForSession(
  session: UserSession
): Promise<RegistryUser[]> {
  const all = await fetchAllUsers();

  if (session.role === "admin") return all;

  if (session.tenantId) {
    return all.filter((u) => u.tenantId === session.tenantId);
  }

  if (session.role === "coach") {
    return all.filter(
      (u) =>
        u.addedBy === session.email ||
        u.email === session.email ||
        (u.role === "student" && u.coach === session.name)
    );
  }

  if (session.role === "student") {
    return all.filter(
      (u) =>
        u.email === session.email ||
        (u.role === "coach" && u.name === session.coach)
    );
  }

  return all;
}

/** 教練 / 管理員可見的學員列表（與 fetchUsersForSession 範圍一致） */
export function filterStudentsForSession(
  session: UserSession,
  registry: RegistryUser[]
): RegistryUser[] {
  if (session.role === "admin") {
    return registry.filter((u) => u.role === "student");
  }

  if (session.role === "coach") {
    const coachEmail = session.email.trim().toLowerCase();
    return registry.filter(
      (u) =>
        u.role === "student" &&
        (u.addedBy === coachEmail ||
          (session.name && u.coach === session.name) ||
          (session.tenantId != null && u.tenantId === session.tenantId))
    );
  }

  return [];
}

export async function emailExists(email: string): Promise<boolean> {
  const user = await fetchUserByEmail(email);
  return Boolean(user);
}

export async function insertUser(
  user: Omit<RegistryUser, "logo" | "appTitle" | "themeColor" | "broadcast">,
  coachSession?: UserSession
): Promise<void> {
  const gymTitle = user.gym || coachSession?.brandName || "Nutrition Coach";
  const { error } = await supabase.from("users_registry").insert({
    email: user.email.trim().toLowerCase(),
    name: user.name,
    role: user.role,
    gym: user.gym,
    coach: user.coach ?? null,
    added_by: user.addedBy ?? null,
    tenant_id: user.tenantId ?? coachSession?.tenantId ?? null,
    app_title: user.role === "coach" ? gymTitle : null,
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
    tenantId: user.tenantId,
    brandName: user.appTitle ?? user.gym,
    brandLogo: user.logo,
    isLoggedIn: true,
  };
}

export function createAdminSession(email: string): UserSession {
  return {
    role: "admin",
    name: "最高總裁 (Kit Au)",
    email: email.trim().toLowerCase(),
    gym: "全港連鎖總部",
    brandName: "連鎖總部",
    isLoggedIn: true,
  };
}

export async function fetchMealLogs(options?: {
  emails?: string[];
  from?: string;
  to?: string;
}): Promise<MealLog[]> {
  let query = supabase
    .from("meal_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.emails && options.emails.length > 0) {
    query = query.in("email", options.emails.map((e) => e.toLowerCase()));
  }
  if (options?.from) {
    query = query.gte("created_at", options.from);
  }
  if (options?.to) {
    query = query.lte("created_at", `${options.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as MealRow[]).map(mapMeal);
}

export async function insertMealLog(
  log: Omit<MealLog, "id" | "createdAt" | "date"> & { email: string },
  options?: { useServiceRole?: boolean }
): Promise<MealLog> {
  const client = options?.useServiceRole
    ? (await import("@/lib/supabase-admin")).getSupabaseAdmin()
    : supabase;

  const email = log.email.trim().toLowerCase();
  const attempts: Record<string, unknown>[] = [
    {
      email,
      meal_type: log.mealType,
      description: log.description,
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbs,
      fats: log.fats,
      image_base64: log.imageUrl ? null : log.imageBase64 ?? null,
      image_url: log.imageUrl ?? null,
    },
    {
      email,
      meal_type: log.mealType,
      description: log.description,
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbs,
      fats: log.fats,
      image_base64: log.imageUrl ? null : log.imageBase64 ?? null,
    },
    {
      email,
      meal_type: log.mealType,
      description: log.description,
      calories: log.calories,
    },
  ];

  let lastError: unknown = null;
  for (const row of attempts) {
    const { data, error } = await client
      .from("meal_logs")
      .insert(row)
      .select("*")
      .single();

    if (!error) return mapMeal(data as MealRow);

    lastError = error;
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "";
    const msg = error.message ?? "";
    const missingColumn =
      code === "PGRST204" ||
      msg.includes("schema cache") ||
      msg.includes("Could not find");
    if (!missingColumn) break;
  }

  if (lastError) throw toReadableError(lastError, "meal_logs 寫入失敗");
  throw new Error("meal_logs 寫入失敗");
}

export async function fetchMealLogsForSession(
  session: UserSession,
  registry: RegistryUser[],
  filters?: { emails?: string[]; from?: string; to?: string }
): Promise<MealLog[]> {
  if (session.role === "admin") {
    return fetchMealLogs(filters);
  }

  if (session.role === "coach") {
    const studentEmails = filterStudentsForSession(session, registry).map(
      (u) => u.email
    );
    if (studentEmails.length === 0) return [];

    const emails = filters?.emails?.length
      ? filters.emails.filter((e) => studentEmails.includes(e))
      : studentEmails;

    return fetchMealLogs({ ...filters, emails });
  }

  return fetchMealLogs({ ...filters, emails: [session.email] });
}

export async function resolveBranding(
  session: UserSession,
  registry: RegistryUser[]
): Promise<{ branding: CoachBranding; broadcast: string }> {
  const resolved = await resolveBrandForUser(session, registry);
  return {
    branding: resolved.branding,
    broadcast: resolved.broadcast,
  };
}

export async function updateCoachBrandingAdmin(
  coachEmail: string,
  payload: {
    appTitle: string;
    themeColor: ThemeColor;
    logo?: string;
    broadcast: string;
    tenantId?: string;
  }
): Promise<void> {
  const admin = getSupabaseAdmin();
  const email = coachEmail.trim().toLowerCase();

  const { error } = await admin
    .from("users_registry")
    .update({
      app_title: payload.appTitle,
      theme_color: payload.themeColor,
      logo: payload.logo ?? null,
      broadcast: payload.broadcast,
      gym: payload.appTitle,
    })
    .eq("email", email)
    .eq("role", "coach");

  if (error) throw error;

  if (payload.tenantId) {
    await syncTenantBranding(payload.tenantId, {
      gymName: payload.appTitle,
      logoUrl: payload.logo,
      themeColor: payload.themeColor,
    });
  }
}

/** @deprecated 請改用 API /api/coach/branding（service role） */
export async function updateCoachBranding(
  coachEmail: string,
  payload: {
    appTitle: string;
    themeColor: ThemeColor;
    logo?: string;
    broadcast: string;
    tenantId?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from("users_registry")
    .update({
      app_title: payload.appTitle,
      theme_color: payload.themeColor,
      logo: payload.logo ?? null,
      broadcast: payload.broadcast,
      gym: payload.appTitle,
    })
    .eq("email", coachEmail.trim().toLowerCase())
    .eq("role", "coach");

  if (error) throw error;

  if (payload.tenantId) {
    await syncTenantBranding(payload.tenantId, {
      gymName: payload.appTitle,
      logoUrl: payload.logo,
    });
  }
}

export async function updateCoachLogo(
  coachEmail: string,
  logo: string,
  tenantId?: string
): Promise<void> {
  const { error } = await supabase
    .from("users_registry")
    .update({ logo })
    .eq("email", coachEmail.trim().toLowerCase())
    .eq("role", "coach");

  if (error) throw error;

  if (tenantId) {
    const coach = await fetchUserByEmail(coachEmail);
    await syncTenantBranding(tenantId, {
      gymName: coach?.appTitle ?? coach?.gym ?? "Nutrition Coach",
      logoUrl: logo,
    });
  }
}

type BodyProfileRow = {
  email: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  gender: string;
  target_weight_kg: number;
  exercise_calories_daily: number;
  onboarding_complete: boolean;
  updated_at: string;
};

function mapBodyProfile(row: BodyProfileRow): StudentBodyProfile {
  return {
    email: row.email,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    age: row.age,
    gender: row.gender as StudentGender,
    targetWeightKg: Number(row.target_weight_kg),
    exerciseCaloriesDaily: row.exercise_calories_daily ?? 0,
    onboardingComplete: row.onboarding_complete ?? true,
    updatedAt: row.updated_at,
  };
}

const BODY_PROFILE_CACHE_PREFIX = "student_body_profile:";

function readLocalBodyProfile(email: string): StudentBodyProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${BODY_PROFILE_CACHE_PREFIX}${email}`);
    if (!raw) return null;
    return JSON.parse(raw) as StudentBodyProfile;
  } catch {
    return null;
  }
}

export function writeLocalBodyProfile(profile: StudentBodyProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `${BODY_PROFILE_CACHE_PREFIX}${profile.email}`,
    JSON.stringify(profile)
  );
}

export async function fetchStudentBodyProfile(
  email: string
): Promise<StudentBodyProfile | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("student_body_profiles")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    console.warn("[body-profile] fetch failed:", error.message);
    return readLocalBodyProfile(normalized);
  }

  if (data) return mapBodyProfile(data as BodyProfileRow);
  return readLocalBodyProfile(normalized);
}

export async function upsertStudentBodyProfile(
  profile: Omit<StudentBodyProfile, "updatedAt">,
  options?: { useServiceRole?: boolean }
): Promise<StudentBodyProfile> {
  const normalized = profile.email.trim().toLowerCase();
  const row = {
    email: normalized,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    age: profile.age,
    gender: profile.gender,
    target_weight_kg: profile.targetWeightKg,
    exercise_calories_daily: profile.exerciseCaloriesDaily ?? 0,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  };

  const client = options?.useServiceRole
    ? (await import("@/lib/supabase-admin")).getSupabaseAdmin()
    : supabase;

  const { data, error } = await client
    .from("student_body_profiles")
    .upsert(row, { onConflict: "email" })
    .select("*")
    .single();

  if (error) {
    console.warn("[body-profile] upsert failed:", error.message, error.code);
  }

  const saved: StudentBodyProfile = error
    ? {
        ...profile,
        email: normalized,
        onboardingComplete: true,
        updatedAt: row.updated_at,
      }
    : mapBodyProfile(data as BodyProfileRow);

  writeLocalBodyProfile(saved);
  return saved;
}
