import type { MealLog } from "@/lib/types";

export type MealCalorieStatus = "良好" | "注意" | "危險";

export function getMealCalorieStatus(calories: number): MealCalorieStatus {
  if (calories < 400) return "良好";
  if (calories <= 750) return "注意";
  return "危險";
}

export function getMealStatus(log: MealLog): MealCalorieStatus {
  return getMealCalorieStatus(log.calories);
}

export function mealStatusStyles(status: MealCalorieStatus): string {
  if (status === "良好") return "bg-emerald-100 text-emerald-800";
  if (status === "注意") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}
