import type {
  StudentBodyProfile,
  StudentGender,
  UserProfile,
  WeightChangeKgPerWeek,
} from "./types";

/** ~7700 kcal per kg body mass change */
export const KCAL_PER_KG = 7700;

export const WEIGHT_CHANGE_PACE_OPTIONS: Array<{
  value: WeightChangeKgPerWeek;
  i18nKey: string;
  fallback: string;
}> = [
  { value: 1, i18nKey: "bodyProfile.pace.gain1", fallback: "每週增重 +1 kg" },
  { value: 0.5, i18nKey: "bodyProfile.pace.gain05", fallback: "每週增重 +0.5 kg" },
  { value: 0, i18nKey: "bodyProfile.pace.maintain", fallback: "維持體重" },
  { value: -0.5, i18nKey: "bodyProfile.pace.lose05", fallback: "每週減重 -0.5 kg" },
  { value: -1, i18nKey: "bodyProfile.pace.lose1", fallback: "每週減重 -1 kg" },
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
  // legacy Chinese labels
  文職: 1.35,
  外勤: 1.45,
  高體力: 1.65,
};

const FREQ_BONUS: Record<string, number> = {
  low: 0,
  "1-2": 0,
  medium: 0.05,
  "3": 0.05,
  high: 0.1,
  "4-5": 0.1,
  daily: 0.15,
  日日: 0.15,
};

/** Activity multiplier from lifestyle (simplified TDEE). */
export function activityMultiplier(job?: string, weeklyFrequency?: string): number {
  let mult = 1.35;
  if (job) {
    if (JOB_MULTIPLIERS[job] !== undefined) mult = JOB_MULTIPLIERS[job];
    else if (job.includes("高體力")) mult = 1.65;
    else if (job.includes("外勤")) mult = 1.45;
  }
  if (weeklyFrequency) {
    if (FREQ_BONUS[weeklyFrequency] !== undefined) {
      mult += FREQ_BONUS[weeklyFrequency];
    } else if (weeklyFrequency.includes("日日")) mult += 0.15;
    else if (weeklyFrequency.includes("4-5")) mult += 0.1;
    else if (weeklyFrequency.includes("3")) mult += 0.05;
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
  const bmr = computeBmrKg(
    body.weightKg,
    body.heightCm,
    body.age,
    body.gender
  );
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

export function estimateMicronutrients(
  calories: number,
  carbs: number,
  fats: number,
  protein: number
) {
  const fiberG = Math.round(Math.min(38, Math.max(8, calories * 0.014 + carbs * 0.08)));
  const sugarG = Math.round(Math.max(0, carbs * 0.35));
  const satFatG = Math.round(Math.max(0, fats * 0.42));
  const sodiumMg = Math.round(Math.max(800, calories * 1.8));
  const cholesterolMg = Math.round(
    Math.min(500, Math.max(80, fats * 3.2 + protein * 0.2))
  );
  return { fiberG, sugarG, satFatG, sodiumMg, cholesterolMg, protein };
}
