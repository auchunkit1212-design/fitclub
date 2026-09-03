import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import {
  parseWeightChangePace,
} from "@/lib/body-profile";
import { getSupabase, getSupabaseAdmin, getSupabaseServiceRole } from "@/lib/supabase";
import { normalizeUserPlan } from "@/lib/user-plan";
import type {
  RegistryUser,
  StudentBodyProfile,
  StudentGender,
  UserSession,
} from "@/lib/types";

type UserRow = {
  email: string;
  name: string;
  role: "student" | "coach";
  plan?: string | null;
  gym?: string | null;
  coach?: string | null;
  added_by?: string | null;
  tenant_id?: string | null;
  password_hash?: string | null;
};

type BodyProfileRow = {
  email: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  gender: string;
  target_weight_kg: number;
  weight_change_kg_per_week?: number | null;
  exercise_calories_daily: number;
  onboarding_complete: boolean;
  updated_at: string;
};

function mapUser(row: UserRow, includePasswordHash = false): RegistryUser {
  const user: RegistryUser = {
    email: row.email,
    name: row.name,
    role: row.role,
    plan: normalizeUserPlan(row.plan),
    gym: row.gym ?? "",
    coach: row.coach ?? undefined,
    addedBy: row.added_by ?? undefined,
    tenantId: row.tenant_id ?? undefined,
    hasPassword: Boolean(row.password_hash),
  };
  if (includePasswordHash && row.password_hash) {
    user.passwordHash = row.password_hash;
  }
  return user;
}

function mapBodyProfile(row: BodyProfileRow): StudentBodyProfile {
  return {
    email: row.email,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    age: row.age,
    gender: row.gender as StudentGender,
    targetWeightKg: Number(row.target_weight_kg),
    weightChangeKgPerWeek: parseWeightChangePace(row.weight_change_kg_per_week),
    exerciseCaloriesDaily: row.exercise_calories_daily ?? 0,
    onboardingComplete: row.onboarding_complete ?? true,
    updatedAt: row.updated_at,
  };
}

export async function fetchPasswordHashForEmail(
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const admin = getSupabaseServiceRole();
  const { data, error } = await admin
    .from("users_registry")
    .select("password_hash")
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw error;
  const hash = data?.password_hash;
  return typeof hash === "string" && hash.trim() ? hash.trim() : null;
}

export async function fetchUserByEmailForAuth(
  email: string
): Promise<RegistryUser | null> {
  const normalized = email.trim().toLowerCase();
  const admin = getSupabaseServiceRole();
  const { data, error } = await admin
    .from("users_registry")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw error;
  if (data) return mapUser(data as UserRow, true);
  return null;
}

export function registryUserToSession(user: RegistryUser): UserSession {
  return {
    role: user.email === SUPER_ADMIN_EMAIL ? "admin" : user.role,
    name: user.name,
    email: user.email,
    gym: user.gym,
    coach: user.coach,
    addedBy: user.addedBy,
    tenantId: user.tenantId,
    plan: normalizeUserPlan(user.plan),
    isLoggedIn: true,
  };
}

export async function fetchStudentBodyProfile(
  email: string
): Promise<StudentBodyProfile | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await getSupabaseAdmin()
    .from("student_body_profiles")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    console.warn("[body-profile] fetch failed:", error.message);
    return null;
  }
  if (data) return mapBodyProfile(data as BodyProfileRow);
  return null;
}

export async function upsertStudentBodyProfile(
  profile: Omit<StudentBodyProfile, "updatedAt">
): Promise<StudentBodyProfile> {
  const normalized = profile.email.trim().toLowerCase();
  const row = {
    email: normalized,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    age: profile.age,
    gender: profile.gender,
    target_weight_kg: profile.targetWeightKg,
    weight_change_kg_per_week: parseWeightChangePace(
      profile.weightChangeKgPerWeek
    ),
    exercise_calories_daily: profile.exerciseCaloriesDaily ?? 0,
    onboarding_complete:
      profile.onboardingComplete !== false &&
      parseWeightChangePace(profile.weightChangeKgPerWeek) !== null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabaseAdmin()
    .from("student_body_profiles")
    .upsert(row, { onConflict: "email" })
    .select("*")
    .single();

  if (error) {
    console.warn("[body-profile] upsert failed:", error.message);
    return {
      ...profile,
      email: normalized,
      onboardingComplete: true,
      updatedAt: row.updated_at,
    };
  }
  return mapBodyProfile(data as BodyProfileRow);
}

/** Soft check that anon client can be constructed (optional). */
export function pingSupabaseAnon(): boolean {
  try {
    getSupabase();
    return true;
  } catch {
    return false;
  }
}
