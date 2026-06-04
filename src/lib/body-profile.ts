import type { StudentBodyProfile, StudentGender, UserProfile } from "./types";

export function isBodyProfileComplete(
  profile: StudentBodyProfile | null | undefined
): boolean {
  if (!profile) return false;
  return (
    profile.heightCm > 0 &&
    profile.weightKg > 0 &&
    profile.age > 0 &&
    Boolean(profile.gender) &&
    profile.targetWeightKg > 0
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

/** Activity multiplier from lifestyle (simplified TDEE). */
export function activityMultiplier(job?: string, weeklyFrequency?: string): number {
  let mult = 1.35;
  if (job?.includes("高體力")) mult = 1.65;
  else if (job?.includes("外勤")) mult = 1.45;
  if (weeklyFrequency?.includes("日日")) mult += 0.15;
  else if (weeklyFrequency?.includes("4-5")) mult += 0.1;
  else if (weeklyFrequency?.includes("3次")) mult += 0.05;
  return Math.min(1.85, mult);
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
  const losing = body.targetWeightKg < body.weightKg;
  const gaining = body.targetWeightKg > body.weightKg;
  let targetCalories = tdee;
  if (losing) targetCalories = Math.max(1200, tdee - 400);
  if (gaining) targetCalories = tdee + 300;

  const targetProtein = Math.round(
    Math.max(80, body.weightKg * (losing ? 2 : 1.6))
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
