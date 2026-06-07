import { readApiJson } from "@/lib/api-client";
import type { MealBaselineSource } from "@/lib/meal-ai-verify";
import { getSessionRequestHeaders } from "@/lib/session";
import type { FoodAdvancedNutrients } from "@/lib/types";

export type MealEstimateResult = {
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  description: string;
  source: string;
  note?: string;
  adjusted: boolean;
};

export async function estimateMealNutritionClient(input: {
  description: string;
  baseline?: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  imageBase64?: string;
  baselineSource?: MealBaselineSource;
  advanced?: FoodAdvancedNutrients;
}): Promise<MealEstimateResult> {
  const res = await fetch("/api/meals/verify-nutrition", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getSessionRequestHeaders(),
    },
    body: JSON.stringify({
      description: input.description,
      baseline: input.baseline,
      imageBase64: input.imageBase64,
      baselineSource: input.baselineSource,
      advanced: input.advanced,
    }),
  });

  const { data, parseError } = await readApiJson<
    MealEstimateResult & { error?: string; ok?: boolean }
  >(res);

  if (!res.ok || parseError || !data?.macros) {
    throw new Error(data?.error ?? `AI 估算失敗 (HTTP ${res.status})`);
  }

  return {
    macros: data.macros,
    description: data.description ?? input.description,
    source: data.source ?? "openrouter",
    note: data.note,
    adjusted: Boolean(data.adjusted),
  };
}
