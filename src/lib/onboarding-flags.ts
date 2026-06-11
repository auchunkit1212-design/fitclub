const MEAL_PLAN_USED_PREFIX = "fitclub:used_meal_plan:";

export function hasUsedMealPlan(email: string): boolean {
  if (typeof window === "undefined" || !email.trim()) return false;
  return localStorage.getItem(`${MEAL_PLAN_USED_PREFIX}${email.trim().toLowerCase()}`) === "1";
}

export function markHasUsedMealPlan(email: string): void {
  if (typeof window === "undefined" || !email.trim()) return;
  localStorage.setItem(`${MEAL_PLAN_USED_PREFIX}${email.trim().toLowerCase()}`, "1");
}
