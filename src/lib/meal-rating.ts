import type { MealCalorieStatus } from "@/lib/meal-status";
import { mealStatusStyles } from "@/lib/meal-status";

export type CoachMealRatingValue = "good" | "caution" | "danger";

export const COACH_MEAL_RATING_OPTIONS: {
  value: CoachMealRatingValue;
  label: MealCalorieStatus;
}[] = [
  { value: "good", label: "良好" },
  { value: "caution", label: "注意" },
  { value: "danger", label: "危險" },
];

export function isValidCoachMealRating(
  value: string
): value is CoachMealRatingValue {
  return value === "good" || value === "caution" || value === "danger";
}

export function coachRatingToLabel(
  rating: CoachMealRatingValue
): MealCalorieStatus {
  const match = COACH_MEAL_RATING_OPTIONS.find((o) => o.value === rating);
  return match?.label ?? "注意";
}

export function mealRatingLabel(
  rating: CoachMealRatingValue | null | undefined
): string {
  if (!rating) return "未評價";
  return coachRatingToLabel(rating);
}

export function mealRatingBadgeStyle(
  rating: CoachMealRatingValue | null | undefined
): string {
  if (!rating) return "bg-zinc-100 text-zinc-500";
  return mealStatusStyles(coachRatingToLabel(rating));
}

export function mealRatingButtonClass(
  value: CoachMealRatingValue,
  selected: CoachMealRatingValue | null | undefined
): string {
  const base = "px-2.5 py-1.5 rounded-lg text-xs font-bold border ";
  if (selected !== value) {
    return `${base}bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50`;
  }
  if (value === "good") return `${base}bg-emerald-600 border-emerald-600 text-white`;
  if (value === "caution") return `${base}bg-amber-500 border-amber-500 text-white`;
  return `${base}bg-red-500 border-red-500 text-white`;
}
