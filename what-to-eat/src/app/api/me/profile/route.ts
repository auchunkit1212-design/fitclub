import { NextRequest, NextResponse } from "next/server";
import {
  computeTargetProfile,
  deriveMacroTargets,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import { fetchStudentBodyProfile, upsertStudentBodyProfile } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";
import type {
  CookingScene,
  DietStyle,
  GoalType,
  MealSchedule,
  MedicalFlag,
  StudentBodyProfile,
  StudentGender,
  WteDietProfile,
  Allergen,
  CuisinePref,
  WeightChangeKgPerWeek,
} from "@/lib/types";
import { fetchDietProfile, upsertDietProfile } from "@/lib/wte-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const [body, diet] = await Promise.all([
    fetchStudentBodyProfile(session.email),
    fetchDietProfile(session.email),
  ]);
  return NextResponse.json({ body, diet });
}

export async function PUT(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    body?: Partial<StudentBodyProfile>;
    diet?: Partial<WteDietProfile> & { targets?: WteDietProfile["targets"] };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const email = session.email.trim().toLowerCase();

  let savedBody: StudentBodyProfile | null = null;
  if (body.body) {
    const b = body.body;
    const heightCm = Number(b.heightCm);
    const weightKg = Number(b.weightKg);
    const age = Number(b.age);
    const targetWeightKg = Number(b.targetWeightKg);
    const gender = (b.gender ?? "other") as StudentGender;
    const pace = b.weightChangeKgPerWeek as WeightChangeKgPerWeek | null;
    if (
      !(heightCm > 0 && weightKg > 0 && age > 0 && targetWeightKg > 0 && gender)
    ) {
      return NextResponse.json({ error: "身體數據不完整" }, { status: 400 });
    }
    savedBody = await upsertStudentBodyProfile({
      email,
      heightCm,
      weightKg,
      age,
      gender,
      targetWeightKg,
      weightChangeKgPerWeek: pace,
      exerciseCaloriesDaily: Number(b.exerciseCaloriesDaily ?? 0),
      onboardingComplete: true,
    });
  } else {
    savedBody = await fetchStudentBodyProfile(email);
  }

  const existingDiet = await fetchDietProfile(email);
  const d = body.diet ?? {};
  const goalType = (d.goalType ?? existingDiet?.goalType ?? "maintain") as GoalType;
  const job = d.job ?? existingDiet?.job ?? "sedentary";
  const weeklyFrequency =
    d.weeklyFrequency ?? existingDiet?.weeklyFrequency ?? "1-2";
  const dietStyles = (d.dietStyles ??
    existingDiet?.dietStyles ??
    []) as DietStyle[];

  let targets = d.targets ?? existingDiet?.targets;
  const calorieMode = d.calorieMode ?? existingDiet?.calorieMode ?? "auto";
  if (calorieMode === "auto" && savedBody && isBodyProfileComplete(savedBody)) {
    const base = computeTargetProfile(savedBody, { job, weeklyFrequency });
    const protein =
      (d.proteinPriority ?? existingDiet?.proteinPriority) === "high"
        ? Math.round(base.targetProtein * 1.1)
        : base.targetProtein;
    targets = deriveMacroTargets(base.targetCalories, protein, dietStyles);
  }
  if (!targets) {
    targets = { calories: 2000, protein: 120, carbs: 200, fats: 60 };
  }

  const dietProfile: WteDietProfile = {
    email,
    goalType,
    job,
    weeklyFrequency,
    mealSchedule: (d.mealSchedule ??
      existingDiet?.mealSchedule ??
      "threeMeals") as MealSchedule,
    cookingScenes: (d.cookingScenes ??
      existingDiet?.cookingScenes ??
      ["home", "takeout"]) as CookingScene[],
    dietStyles,
    allergens: (d.allergens ?? existingDiet?.allergens ?? []) as Allergen[],
    dislikedIngredients:
      d.dislikedIngredients ?? existingDiet?.dislikedIngredients ?? [],
    cuisinePrefs: (d.cuisinePrefs ??
      existingDiet?.cuisinePrefs ??
      ["cantonese"]) as CuisinePref[],
    proteinPriority:
      d.proteinPriority ?? existingDiet?.proteinPriority ?? "normal",
    proteinSources: d.proteinSources ?? existingDiet?.proteinSources ?? [],
    medicalFlags: (d.medicalFlags ??
      existingDiet?.medicalFlags ??
      []) as MedicalFlag[],
    medicalDisclaimerAccepted: Boolean(
      d.medicalDisclaimerAccepted ??
        existingDiet?.medicalDisclaimerAccepted ??
        false
    ),
    calorieMode,
    targets,
    onboardingComplete: Boolean(
      d.onboardingComplete ?? existingDiet?.onboardingComplete ?? false
    ),
  };

  if (
    dietProfile.onboardingComplete &&
    !dietProfile.medicalDisclaimerAccepted
  ) {
    return NextResponse.json(
      { error: "請先確認醫療免責聲明" },
      { status: 400 }
    );
  }

  try {
    const savedDiet = await upsertDietProfile(dietProfile);
    return NextResponse.json({ body: savedBody, diet: savedDiet });
  } catch (err) {
    const message = err instanceof Error ? err.message : "儲存失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
