import {
  estimateMealNutritionWithAi,
  type MealVerifyResult,
} from "@/lib/meal-ai-verify";
import type { MacroEstimate } from "@/lib/macro-scale";

export type MealReestimateResult = {
  macros: MacroEstimate;
  source: "openrouter" | "openrouter_vision" | "baseline";
  parts?: { name: string; macros: MacroEstimate }[];
  note?: string;
};

function toReestimateResult(result: MealVerifyResult): MealReestimateResult {
  return {
    macros: result.macros,
    source: result.source,
    note: result.note,
  };
}

/** 依食物描述用 AI 重算營養（不再使用本地規則優先） */
export async function reestimateMealFromDescription(input: {
  description: string;
  coachHint?: MacroEstimate;
}): Promise<MealReestimateResult> {
  const description = input.description.trim();
  if (!description) {
    throw new Error("請填寫食物描述");
  }

  const result = await estimateMealNutritionWithAi({
    description,
    baseline: input.coachHint,
    baselineSource: input.coachHint ? "manual" : undefined,
  });

  return toReestimateResult(result);
}
