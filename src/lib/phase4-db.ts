import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { toReadableError } from "@/lib/errors";
import { fetchAllUsers, fetchUserByEmail } from "@/lib/db";
import { fetchTenantById } from "@/lib/tenant";
import type {
  FavoriteFood,
  MealLog,
  MealLogReaction,
  RegistryUser,
  StudentNutritionTargets,
} from "@/lib/types";

function addCoach(
  coaches: Map<string, RegistryUser>,
  user: RegistryUser | undefined | null
): void {
  if (user?.role === "coach" && user.email) {
    coaches.set(user.email.trim().toLowerCase(), user);
  }
}

/** 找出應收到學員打卡推播的教練（含 tenant 店主及同店教練） */
export async function findCoachesForStudent(
  studentEmail: string
): Promise<RegistryUser[]> {
  const student = await fetchUserByEmail(studentEmail);
  if (!student) return [];

  const all = await fetchAllUsers();
  const coaches = new Map<string, RegistryUser>();

  if (student.addedBy) {
    addCoach(
      coaches,
      all.find(
        (u) =>
          u.role === "coach" &&
          u.email.trim().toLowerCase() === student.addedBy!.trim().toLowerCase()
      )
    );
  }

  if (student.coach?.trim()) {
    addCoach(
      coaches,
      all.find((u) => u.role === "coach" && u.name === student.coach)
    );
  }

  if (student.tenantId) {
    for (const user of all) {
      if (user.role === "coach" && user.tenantId === student.tenantId) {
        addCoach(coaches, user);
      }
    }

    const tenant = await fetchTenantById(student.tenantId);
    if (tenant?.ownerEmail) {
      addCoach(
        coaches,
        all.find(
          (u) =>
            u.email.trim().toLowerCase() ===
            tenant.ownerEmail.trim().toLowerCase()
        )
      );
    }
  }

  return Array.from(coaches.values());
}

export async function findCoachForStudent(
  studentEmail: string
): Promise<RegistryUser | null> {
  const coaches = await findCoachesForStudent(studentEmail);
  return coaches[0] ?? null;
}

export function studentHasCoach(student: RegistryUser | null): boolean {
  return Boolean(
    student?.coach?.trim() || student?.addedBy?.trim() || student?.tenantId
  );
}

export async function fetchStudentNutritionTargets(
  studentEmail: string
): Promise<StudentNutritionTargets | null> {
  const email = studentEmail.trim().toLowerCase();
  const { data, error } = await supabase
    .from("student_nutrition_targets")
    .select("*")
    .eq("student_email", email)
    .maybeSingle();

  if (error || !data) return null;
  return mapTargets(data);
}

export async function fetchNutritionTargetsForEmails(
  emails: string[]
): Promise<Map<string, StudentNutritionTargets>> {
  const normalized = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  );
  const map = new Map<string, StudentNutritionTargets>();
  if (normalized.length === 0) return map;

  const { data, error } = await supabase
    .from("student_nutrition_targets")
    .select("*")
    .in("student_email", normalized);

  if (error || !data) return map;
  for (const row of data) {
    const t = mapTargets(row as Record<string, unknown>);
    map.set(t.studentEmail.trim().toLowerCase(), t);
  }
  return map;
}

export async function upsertStudentNutritionTargets(
  targets: StudentNutritionTargets,
  options?: { useServiceRole?: boolean }
): Promise<StudentNutritionTargets> {
  const client = options?.useServiceRole ? getSupabaseAdmin() : supabase;

  const row: Record<string, unknown> = {
    student_email: targets.studentEmail.trim().toLowerCase(),
    target_calories: Math.round(targets.targetCalories),
    target_protein: Math.round(targets.targetProtein),
    target_carbs: Math.round(targets.targetCarbs),
    target_fats: Math.round(targets.targetFats),
    locked: targets.locked,
    set_by_coach_email: targets.setByCoachEmail ?? null,
    updated_at: new Date().toISOString(),
  };
  if (targets.tenantId) {
    row.tenant_id = targets.tenantId;
  }

  const { data, error } = await client
    .from("student_nutrition_targets")
    .upsert(row, { onConflict: "student_email" })
    .select("*")
    .single();

  if (error) {
    throw toReadableError(
      error,
      "student_nutrition_targets 寫入失敗（請執行 phase4-social-ai.sql 或 fix-tenants-branding.sql）"
    );
  }
  return mapTargets(data);
}

function mapTargets(row: Record<string, unknown>): StudentNutritionTargets {
  return {
    studentEmail: String(row.student_email),
    targetCalories: Number(row.target_calories),
    targetProtein: Number(row.target_protein),
    targetCarbs: Number(row.target_carbs),
    targetFats: Number(row.target_fats),
    locked: Boolean(row.locked),
    setByCoachEmail: row.set_by_coach_email
      ? String(row.set_by_coach_email)
      : undefined,
    tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function insertMealReaction(
  mealLogId: string,
  coachEmail: string,
  sticker: string,
  options?: { useServiceRole?: boolean }
): Promise<MealLogReaction> {
  const client = options?.useServiceRole ? getSupabaseAdmin() : supabase;

  const { data, error } = await client
    .from("meal_log_reactions")
    .upsert(
      {
        meal_log_id: mealLogId,
        coach_email: coachEmail.trim().toLowerCase(),
        sticker,
      },
      { onConflict: "meal_log_id,coach_email" }
    )
    .select("*")
    .single();

  if (error) {
    throw toReadableError(
      error,
      "meal_log_reactions 寫入失敗（請執行 fix-meal-log-reactions.sql）"
    );
  }
  return mapReaction(data);
}

export async function fetchReactionsForMealIds(
  mealLogIds: string[]
): Promise<MealLogReaction[]> {
  if (mealLogIds.length === 0) return [];
  const { data, error } = await supabase
    .from("meal_log_reactions")
    .select("*")
    .in("meal_log_id", mealLogIds);

  if (error) return [];
  return (data ?? []).map(mapReaction);
}

function mapReaction(row: Record<string, unknown>): MealLogReaction {
  return {
    id: String(row.id),
    mealLogId: String(row.meal_log_id),
    coachEmail: String(row.coach_email),
    sticker: String(row.sticker),
    createdAt: String(row.created_at),
  };
}

export async function fetchFavoriteFoods(
  studentEmail: string
): Promise<FavoriteFood[]> {
  const { data, error } = await supabase
    .from("favorite_foods")
    .select("*")
    .eq("student_email", studentEmail.trim().toLowerCase())
    .order("last_used_at", { ascending: false })
    .limit(30);

  if (error) return [];
  return (data ?? []).map(mapFavorite);
}

export async function upsertFavoriteFood(
  food: Omit<FavoriteFood, "id" | "lastUsedAt"> & { id?: string }
): Promise<FavoriteFood> {
  const email = food.studentEmail.trim().toLowerCase();
  const row = {
    student_email: email,
    name: food.name,
    brand: food.brand ?? "",
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fats: food.fats,
    serving_label: food.servingLabel ?? "1 份",
    use_count: food.useCount ?? 1,
    last_used_at: new Date().toISOString(),
  };

  if (food.id) {
    const { data, error } = await supabase
      .from("favorite_foods")
      .update({ ...row, use_count: food.useCount })
      .eq("id", food.id)
      .select("*")
      .single();
    if (error) throw error;
    return mapFavorite(data);
  }

  const { data: existing } = await supabase
    .from("favorite_foods")
    .select("id, use_count")
    .eq("student_email", email)
    .eq("name", food.name)
    .eq("brand", food.brand ?? "")
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("favorite_foods")
      .update({
        ...row,
        use_count: Number(existing.use_count) + 1,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return mapFavorite(data);
  }

  const { data, error } = await supabase
    .from("favorite_foods")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return mapFavorite(data);
}

function mapFavorite(row: Record<string, unknown>): FavoriteFood {
  return {
    id: String(row.id),
    studentEmail: String(row.student_email),
    name: String(row.name),
    brand: String(row.brand ?? ""),
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fats: Number(row.fats),
    servingLabel: String(row.serving_label ?? "1 份"),
    useCount: Number(row.use_count ?? 1),
    lastUsedAt: String(row.last_used_at),
  };
}

/** Students of coach with no meal in last N days */
export async function findInactiveStudentsForCoach(
  coachEmail: string,
  inactiveDays = 2
): Promise<RegistryUser[]> {
  const admin = getSupabaseAdmin();
  const all = await fetchAllUsers();
  const students = all.filter(
    (u) => u.role === "student" && u.addedBy === coachEmail.trim().toLowerCase()
  );
  if (students.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);
  const cutoffIso = cutoff.toISOString();

  const emails = students.map((s) => s.email);
  const { data: recentLogs } = await admin
    .from("meal_logs")
    .select("email, created_at")
    .in("email", emails)
    .gte("created_at", cutoffIso);

  const activeEmails = new Set(
    (recentLogs ?? []).map((r: { email: string }) => r.email.toLowerCase())
  );

  return students.filter((s) => !activeEmails.has(s.email.toLowerCase()));
}

/** Independent students (no coach binding) for AI proxy */
export async function fetchIndependentStudents(): Promise<RegistryUser[]> {
  const all = await fetchAllUsers();
  return all.filter((u) => u.role === "student" && !studentHasCoach(u));
}

export async function fetchTodayLogsForEmail(email: string): Promise<MealLog[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("meal_logs")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    date: String(row.created_at),
    mealType: String(row.meal_type),
    description: String(row.description),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    imageBase64: row.image_base64 ? String(row.image_base64) : undefined,
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fats: Number(row.fats),
    createdAt: String(row.created_at),
  }));
}
