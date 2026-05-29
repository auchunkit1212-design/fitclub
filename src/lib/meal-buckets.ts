import type { MealLog } from "./types";

export type MealBucket = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_BUCKET_LABELS: Record<MealBucket, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "零食",
};

export function getMealBucket(mealType: string): MealBucket {
  if (mealType.includes("早餐")) return "breakfast";
  if (mealType.includes("午餐") || mealType.includes("下午茶")) return "lunch";
  if (mealType.includes("晚餐") || mealType.includes("宵夜")) return "dinner";
  if (mealType.includes("零食")) return "snack";
  return "snack";
}

export function groupLogsByBucket(logs: MealLog[]): Record<MealBucket, MealLog[]> {
  const buckets: Record<MealBucket, MealLog[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const log of logs) {
    buckets[getMealBucket(log.mealType)].push(log);
  }
  return buckets;
}
