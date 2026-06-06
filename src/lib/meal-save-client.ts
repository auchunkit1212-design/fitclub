"use client";

import { getSessionRequestHeaders } from "@/lib/session";
import type { MealBaselineSource } from "@/lib/meal-ai-verify";
import type { FoodAdvancedNutrients, MealLog } from "@/lib/types";

export type SaveMealPayload = {
  email?: string;
  mealType: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  imageUrl?: string;
  imageBase64?: string;
  nutritionSource?: MealBaselineSource;
  advanced?: FoodAdvancedNutrients;
};

export type SaveMealResult = {
  log: MealLog;
  streak?: {
    currentStreak?: number;
    longestStreak?: number;
    milestoneTriggered?: boolean;
    milestoneDays?: number;
  };
  nutritionVerified?: {
    source: string;
    adjusted: boolean;
    note?: string;
  };
};

/** 經 API 儲存飲食（伺服器會自動 AI 覆核，有相片會用 Vision） */
export async function saveMealViaApi(
  payload: SaveMealPayload
): Promise<SaveMealResult> {
  const res = await fetch("/api/meals/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getSessionRequestHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as SaveMealResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `儲存失敗 (HTTP ${res.status})`);
  }
  return data;
}
