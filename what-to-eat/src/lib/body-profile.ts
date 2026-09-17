import type {
  StudentBodyProfile,
  StudentGender,
  UserProfile,
  WeightChangeKgPerWeek,
} from "@/lib/types";

export const KCAL_PER_KG = 7700;

export const WEIGHT_CHANGE_PACE_OPTIONS: Array<{
  value: WeightChangeKgPerWeek;
  i18nKey: string;
  fallback: string;
}> = [
  { value: 1, i18nKey: "body.pace.gain1", fallback: "每週增重 +1 kg" },
  { value: 0.5, i18nKey: "body.pace.gain05", fallback: "每週增重 +0.5 kg" },
  { value: 0, i18nKey: "body.pace.maintain", fallback: "維持體重" },
  { value: -0.5, i18nKey: "body.pace.lose05", fallback: "每週減重 -0.5 kg" },
  { value: -1, i18nKey: "body.pace.lose1", fallback: "每週減重 -1 kg" },
];

export function isValidWeightChangePace(
  value: number | null | undefined
): value is WeightChangeKgPerWeek {
  return value === 1 || value === 0.5 || value === 0 || value === -0.5 || value === -1;
}

export function parseWeightChangePace(
  raw: unknown
): WeightChangeKgPerWeek | null {
  const n = Number(raw);
  return isValidWeightChangePace(n) ? n : null;
}

export function isBodyProfileComplete(
  profile: StudentBodyProfile | null | undefined
): boolean {
  if (!profile) return false;
  if (profile.onboardingComplete === false) return false;
  return (
    profile.heightCm > 0 &&
    profile.weightKg > 0 &&
    profile.age > 0 &&
    Boolean(profile.gender) &&
    profile.targetWeightKg > 0 &&
    isValidWeightChangePace(profile.weightChangeKgPerWeek)
  );
}

export function computeBmrKg(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: StudentGender
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === "male") return base + 5;
  if (gender === "female") return base - 161;
  return base - 78;
}

const JOB_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.35,
  field: 1.45,
  physical: 1.65,
};

const FREQ_BONUS: Record<string, number> = {
  low: 0,
  "1-2": 0,
  medium: 0.05,
  "3": 0.05,
  high: 0.1,
  "4-5": 0.1,
  daily: 0.15,
};

export function activityMultiplier(job?: string, weeklyFrequency?: string): number {
  let mult = 1.35;
  if (job && JOB_MULTIPLIERS[job] !== undefined) mult = JOB_MULTIPLIERS[job];
  if (weeklyFrequency && FREQ_BONUS[weeklyFrequency] !== undefined) {
    mult += FREQ_BONUS[weeklyFrequency];
  }
  return Math.min(1.85, mult);
}

export function dailyCalorieDeltaForPace(
  paceKgPerWeek: WeightChangeKgPerWeek
): number {
  return Math.round((paceKgPerWeek * KCAL_PER_KG) / 7);
}

export function proteinFactorForPace(paceKgPerWeek: WeightChangeKgPerWeek): number {
  if (paceKgPerWeek <= -1) return 2.2;
  if (paceKgPerWeek <= -0.5) return 2.0;
  if (paceKgPerWeek >= 0.5) return 1.8;
  return 1.6;
}

export function computeTargetProfile(
  body: StudentBodyProfile,
  options?: { job?: string; weeklyFrequency?: string }
): UserProfile {
  const bmr = computeBmrKg(body.weightKg, body.heightCm, body.age, body.gender);
  const tdee = Math.round(
    bmr * activityMultiplier(options?.job, options?.weeklyFrequency)
  );
  const pace: WeightChangeKgPerWeek = isValidWeightChangePace(
    body.weightChangeKgPerWeek
  )
    ? body.weightChangeKgPerWeek
    : 0;
  const dailyDelta = dailyCalorieDeltaForPace(pace);
  let targetCalories = Math.round(tdee + dailyDelta);
  targetCalories = Math.min(5000, Math.max(1200, targetCalories));
  const targetProtein = Math.round(
    Math.max(80, body.weightKg * proteinFactorForPace(pace))
  );
  return { targetCalories, targetProtein };
}

/** Derive carbs/fats from calories + protein with diet-style bias. */
export function deriveMacroTargets(
  calories: number,
  protein: number,
  dietStyles: string[] = []
): { calories: number; protein: number; carbs: number; fats: number } {
  const proteinKcal = protein * 4;
  const remaining = Math.max(0, calories - proteinKcal);
  const keto = dietStyles.includes("keto");
  const lowCarb = dietStyles.includes("low_carb") || keto;
  let carbRatio = lowCarb ? (keto ? 0.08 : 0.25) : 0.45;
  let fatRatio = 1 - carbRatio;
  const carbs = Math.round((remaining * carbRatio) / 4);
  const fats = Math.round((remaining * fatRatio) / 9);
  return { calories, protein, carbs, fats };
}
