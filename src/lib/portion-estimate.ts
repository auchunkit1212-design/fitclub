import { PORTION_NONE } from "@/lib/ai-mock";

export const MEAL_TYPE_KEYS = [
  "breakfast",
  "lunch",
  "dinner",
  "afternoonTea",
  "lateNight",
  "snack",
] as const;

export type MealTypeKey = (typeof MEAL_TYPE_KEYS)[number];

export const CARBS_PORTION_KEYS = [
  "none",
  "carbsSmall",
  "carbsMedium",
  "carbsLarge",
] as const;

export type CarbsPortionKey = (typeof CARBS_PORTION_KEYS)[number];

export const PROTEIN_PORTION_KEYS = [
  "none",
  "proteinSmall",
  "proteinMedium",
  "proteinLarge",
] as const;

export type ProteinPortionKey = (typeof PROTEIN_PORTION_KEYS)[number];

/** Maps UI keys to legacy strings used by estimateMacros */
export function carbsPortionKeyToLegacy(key: CarbsPortionKey): string {
  const map: Record<CarbsPortionKey, string> = {
    none: PORTION_NONE,
    carbsSmall: "細拳",
    carbsMedium: "中拳",
    carbsLarge: "大拳",
  };
  return map[key];
}

export function proteinPortionKeyToLegacy(key: ProteinPortionKey): string {
  const map: Record<ProteinPortionKey, string> = {
    none: PORTION_NONE,
    proteinSmall: "細掌",
    proteinMedium: "中掌",
    proteinLarge: "大掌",
  };
  return map[key];
}

export function veggiesKeyToLegacy(hasVeggies: boolean): string {
  return hasVeggies ? "有" : PORTION_NONE;
}
