import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  MacroTargets,
  WteDietProfile,
  WteMealPlanRow,
  WeeklyMealPlanPayload,
} from "@/lib/types";

type DietRow = {
  email: string;
  goal_type: string;
  job: string;
  weekly_frequency: string;
  meal_schedule: string;
  cooking_scenes: string[] | null;
  diet_styles: string[] | null;
  allergens: string[] | null;
  disliked_ingredients: string[] | null;
  cuisine_prefs: string[] | null;
  protein_priority: string;
  protein_sources: string[] | null;
  medical_flags: string[] | null;
  medical_disclaimer_accepted: boolean;
  calorie_mode: string;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fats: number;
  onboarding_complete: boolean;
  updated_at: string;
};

type PlanRow = {
  id: string;
  email: string;
  week_start: string;
  payload: WeeklyMealPlanPayload;
  notes: string | null;
  version: number;
  regenerate_count: number;
  created_at: string;
  updated_at: string;
};

function mapDiet(row: DietRow): WteDietProfile {
  return {
    email: row.email,
    goalType: row.goal_type as WteDietProfile["goalType"],
    job: row.job,
    weeklyFrequency: row.weekly_frequency,
    mealSchedule: row.meal_schedule as WteDietProfile["mealSchedule"],
    cookingScenes: (row.cooking_scenes ?? []) as WteDietProfile["cookingScenes"],
    dietStyles: (row.diet_styles ?? []) as WteDietProfile["dietStyles"],
    allergens: (row.allergens ?? []) as WteDietProfile["allergens"],
    dislikedIngredients: row.disliked_ingredients ?? [],
    cuisinePrefs: (row.cuisine_prefs ?? []) as WteDietProfile["cuisinePrefs"],
    proteinPriority: row.protein_priority as WteDietProfile["proteinPriority"],
    proteinSources: row.protein_sources ?? [],
    medicalFlags: (row.medical_flags ?? []) as WteDietProfile["medicalFlags"],
    medicalDisclaimerAccepted: row.medical_disclaimer_accepted,
    calorieMode: row.calorie_mode as WteDietProfile["calorieMode"],
    targets: {
      calories: row.target_calories,
      protein: row.target_protein,
      carbs: row.target_carbs,
      fats: row.target_fats,
    },
    onboardingComplete: row.onboarding_complete,
    updatedAt: row.updated_at,
  };
}

function mapPlan(row: PlanRow): WteMealPlanRow & { regenerateCount: number } {
  return {
    id: row.id,
    email: row.email,
    weekStart: row.week_start,
    payload: row.payload,
    notes: row.notes,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    regenerateCount: row.regenerate_count ?? 0,
  };
}

export async function fetchDietProfile(
  email: string
): Promise<WteDietProfile | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await getSupabaseAdmin()
    .from("wte_diet_profiles")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    console.warn("[wte-diet] fetch failed:", error.message);
    return null;
  }
  return data ? mapDiet(data as DietRow) : null;
}

export async function upsertDietProfile(
  profile: WteDietProfile
): Promise<WteDietProfile> {
  const normalized = profile.email.trim().toLowerCase();
  const row = {
    email: normalized,
    goal_type: profile.goalType,
    job: profile.job,
    weekly_frequency: profile.weeklyFrequency,
    meal_schedule: profile.mealSchedule,
    cooking_scenes: profile.cookingScenes,
    diet_styles: profile.dietStyles,
    allergens: profile.allergens,
    disliked_ingredients: profile.dislikedIngredients,
    cuisine_prefs: profile.cuisinePrefs,
    protein_priority: profile.proteinPriority,
    protein_sources: profile.proteinSources,
    medical_flags: profile.medicalFlags,
    medical_disclaimer_accepted: profile.medicalDisclaimerAccepted,
    calorie_mode: profile.calorieMode,
    target_calories: profile.targets.calories,
    target_protein: profile.targets.protein,
    target_carbs: profile.targets.carbs,
    target_fats: profile.targets.fats,
    onboarding_complete: profile.onboardingComplete,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabaseAdmin()
    .from("wte_diet_profiles")
    .upsert(row, { onConflict: "email" })
    .select("*")
    .single();

  if (error) throw new Error(`儲存飲食檔案失敗：${error.message}`);
  return mapDiet(data as DietRow);
}

export function currentMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getGenerateUsage(
  email: string,
  monthKey = currentMonthKey()
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await getSupabaseAdmin()
    .from("wte_usage")
    .select("generate_count")
    .eq("email", normalized)
    .eq("month_key", monthKey)
    .maybeSingle();
  if (error) {
    console.warn("[wte-usage] fetch failed:", error.message);
    return 0;
  }
  return Number(data?.generate_count ?? 0);
}

export async function incrementGenerateUsage(
  email: string,
  monthKey = currentMonthKey()
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const current = await getGenerateUsage(normalized, monthKey);
  const next = current + 1;
  const { error } = await getSupabaseAdmin().from("wte_usage").upsert(
    {
      email: normalized,
      month_key: monthKey,
      generate_count: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email,month_key" }
  );
  if (error) throw new Error(`更新用量失敗：${error.message}`);
  return next;
}

export async function insertMealPlan(input: {
  email: string;
  weekStart: string;
  payload: WeeklyMealPlanPayload;
  notes?: string;
}): Promise<WteMealPlanRow & { regenerateCount: number }> {
  const normalized = input.email.trim().toLowerCase();
  const { data, error } = await getSupabaseAdmin()
    .from("wte_meal_plans")
    .insert({
      email: normalized,
      week_start: input.weekStart,
      payload: input.payload,
      notes: input.notes ?? null,
      version: 1,
      regenerate_count: 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(`儲存餐單失敗：${error.message}`);
  return mapPlan(data as PlanRow);
}

export async function fetchLatestMealPlan(
  email: string
): Promise<(WteMealPlanRow & { regenerateCount: number }) | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await getSupabaseAdmin()
    .from("wte_meal_plans")
    .select("*")
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[wte-plan] fetch failed:", error.message);
    return null;
  }
  return data ? mapPlan(data as PlanRow) : null;
}

export async function fetchMealPlanById(
  id: string,
  email: string
): Promise<(WteMealPlanRow & { regenerateCount: number }) | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await getSupabaseAdmin()
    .from("wte_meal_plans")
    .select("*")
    .eq("id", id)
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPlan(data as PlanRow) : null;
}

export async function updateMealPlanPayload(
  id: string,
  email: string,
  payload: WeeklyMealPlanPayload,
  bumpRegen: boolean
): Promise<WteMealPlanRow & { regenerateCount: number }> {
  const existing = await fetchMealPlanById(id, email);
  if (!existing) throw new Error("找不到餐單");
  const regenerateCount = bumpRegen
    ? existing.regenerateCount + 1
    : existing.regenerateCount;
  const { data, error } = await getSupabaseAdmin()
    .from("wte_meal_plans")
    .update({
      payload,
      version: existing.version + 1,
      regenerate_count: regenerateCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("email", email.trim().toLowerCase())
    .select("*")
    .single();
  if (error) throw new Error(`更新餐單失敗：${error.message}`);
  return mapPlan(data as PlanRow);
}

export async function addFavorite(email: string, planId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("wte_plan_favorites").upsert(
    {
      email: email.trim().toLowerCase(),
      plan_id: planId,
      created_at: new Date().toISOString(),
    },
    { onConflict: "email,plan_id" }
  );
  if (error) throw new Error(`收藏失敗：${error.message}`);
}

export async function removeFavorite(
  email: string,
  planId: string
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("wte_plan_favorites")
    .delete()
    .eq("email", email.trim().toLowerCase())
    .eq("plan_id", planId);
  if (error) throw new Error(`取消收藏失敗：${error.message}`);
}

export async function listFavorites(
  email: string
): Promise<Array<WteMealPlanRow & { regenerateCount: number }>> {
  const normalized = email.trim().toLowerCase();
  const { data: favs, error } = await getSupabaseAdmin()
    .from("wte_plan_favorites")
    .select("plan_id")
    .eq("email", normalized)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (favs ?? []).map((f) => f.plan_id as string);
  if (ids.length === 0) return [];
  const { data: plans, error: planErr } = await getSupabaseAdmin()
    .from("wte_meal_plans")
    .select("*")
    .in("id", ids);
  if (planErr) throw planErr;
  return (plans as PlanRow[]).map(mapPlan);
}

export function mondayOfWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function defaultTargets(): MacroTargets {
  return { calories: 2000, protein: 120, carbs: 200, fats: 60 };
}
