import type { FoodAdvancedNutrients } from "@/lib/types";

export type MacroValues = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type PortionPreset = "full" | "half" | "third" | "quarter" | "custom";

export function scaleMacroValue(value: number, ratio: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.round(value * ratio));
}

export function scaleMacros(macros: MacroValues, ratio: number): MacroValues {
  const r = Math.max(0, Math.min(1, ratio));
  return {
    calories: scaleMacroValue(macros.calories, r),
    protein: scaleMacroValue(macros.protein, r),
    carbs: scaleMacroValue(macros.carbs, r),
    fats: scaleMacroValue(macros.fats, r),
  };
}

export function scaleAdvancedNutrients(
  advanced: FoodAdvancedNutrients | undefined,
  ratio: number
): FoodAdvancedNutrients | undefined {
  if (!advanced) return undefined;
  const r = Math.max(0, Math.min(1, ratio));
  const scale = (n?: number) =>
    n != null && n > 0 ? scaleMacroValue(n, r) : undefined;
  return {
    fiberG: scale(advanced.fiberG),
    sugarG: scale(advanced.sugarG),
    saturatedFatG: scale(advanced.saturatedFatG),
    sodiumMg: scale(advanced.sodiumMg),
    cholesterolMg: scale(advanced.cholesterolMg),
  };
}

export function ratioFromPreset(preset: PortionPreset): number {
  switch (preset) {
    case "half":
      return 0.5;
    case "third":
      return 1 / 3;
    case "quarter":
      return 0.25;
    case "full":
    case "custom":
    default:
      return 1;
  }
}

export function ratioFromGrams(grams: number, baseGrams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 1;
  if (!Number.isFinite(baseGrams) || baseGrams <= 0) return 1;
  return Math.max(0, Math.min(1, grams / baseGrams));
}

/** Parse "約 250g" / "40g" from serving labels */
export function parseGramsFromLabel(label: string): number | undefined {
  const m = label.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export function buildPortionedDescription(
  productName: string,
  portionLabel: string
): string {
  const name = productName.trim();
  const portion = portionLabel.trim();
  if (!name) return portion;
  if (!portion || portion === "全份") return name;
  return `${name}（${portion}）`;
}
