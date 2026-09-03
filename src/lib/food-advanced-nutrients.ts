import { estimateMicronutrients } from "@/lib/body-profile";
import type { FoodAdvancedNutrients } from "@/lib/types";

function roundOptional(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

/** Parse AI / API row fields into advanced nutrients */
export function parseAdvancedFromAiRow(row: Record<string, unknown>): FoodAdvancedNutrients {
  return {
    fiberG: roundOptional(row.fiber ?? row.fiber_g),
    sugarG: roundOptional(row.sugar ?? row.sugar_g),
    saturatedFatG: roundOptional(row.saturated_fat ?? row.saturatedFat),
    sodiumMg: roundOptional(row.sodium_mg ?? row.sodium),
    cholesterolMg: roundOptional(row.cholesterol_mg ?? row.cholesterol),
  };
}

/** Fill missing advanced fields from macros (HK DB / favorites without micro data) */
export function resolveFoodAdvancedNutrients(
  macros: { calories: number; protein: number; carbs: number; fats: number },
  partial?: FoodAdvancedNutrients
): Required<FoodAdvancedNutrients> {
  const est = estimateMicronutrients(
    macros.calories,
    macros.carbs,
    macros.fats,
    macros.protein
  );

  return {
    fiberG: partial?.fiberG ?? est.fiberG,
    sugarG: partial?.sugarG ?? est.sugarG,
    saturatedFatG: partial?.saturatedFatG ?? est.satFatG,
    sodiumMg: partial?.sodiumMg ?? est.sodiumMg,
    cholesterolMg:
      partial?.cholesterolMg ??
      Math.round(Math.max(0, macros.fats * 3.5 + macros.protein * 0.2)),
  };
}

export function hasAiAdvancedNutrients(partial?: FoodAdvancedNutrients): boolean {
  if (!partial) return false;
  return (
    partial.fiberG != null ||
    partial.sugarG != null ||
    partial.saturatedFatG != null ||
    partial.sodiumMg != null ||
    partial.cholesterolMg != null
  );
}
