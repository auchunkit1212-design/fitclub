import type { MacroEstimate } from "@/lib/macro-scale";

/** 將「A+B、C，D」類描述拆成多個食物片段 */
export function splitMealDescription(description: string): string[] {
  const normalized = description.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const parts = normalized
    .split(
      /(?:\s*\+\s*|\s*、\s*|\s*,\s*|\s+and\s+|\s+&\s+|再加|加多|加個|加一件|加一份|同埋|連埋|再配|配埋|以及)/i
    )
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);

  return parts.length > 0 ? parts : [normalized];
}

export function sumMacros(items: MacroEstimate[]): MacroEstimate {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fats: acc.fats + item.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

export function isCompositeMealDescription(description: string): boolean {
  return splitMealDescription(description).length > 1;
}

export function formatCompositeBreakdown(
  parts: { name: string; macros: MacroEstimate }[]
): string {
  return parts
    .map((p) => `${p.name} ${p.macros.calories}kcal`)
    .join(" + ");
}
