import type { MealLog } from "./types";

export type MealBucket = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_BUCKET_LABELS: Record<MealBucket, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "零食",
};

export function getMealBucket(mealType: string): MealBucket {
  const m = mealType.toLowerCase();
  if (/早餐|breakfast|morning/i.test(mealType) || m.includes("breakfast")) return "breakfast";
  if (/午餐|lunch|下午茶|afternoon/i.test(mealType)) return "lunch";
  if (/晚餐|dinner|宵夜|late.?night|supper/i.test(mealType)) return "dinner";
  if (/零食|snack/i.test(mealType)) return "snack";
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
