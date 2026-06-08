import { readApiJson } from "@/lib/api-client";
import type { AppLanguage } from "@/lib/i18n";
import type { DetectedMealFood } from "@/lib/meal-photo-detect";
import { getSessionRequestHeaders } from "@/lib/session";

export type DetectMealFoodsResult =
  | { ok: true; foods: DetectedMealFood[]; source?: string }
  | { ok: false; error: string };

export async function detectMealFoodsFromPhoto(
  imageBase64: string,
  lang: AppLanguage
): Promise<DetectMealFoodsResult> {
  try {
    const res = await fetch("/api/ai/detect-meal-foods", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getSessionRequestHeaders(),
      },
      body: JSON.stringify({ imageBase64, lang }),
    });

    const { data, parseError } = await readApiJson<{
      foods?: DetectedMealFood[];
      source?: string;
      error?: string;
    }>(res);

    if (!res.ok || parseError) {
      return {
        ok: false,
        error: data?.error ?? `AI 食物辨識失敗 (HTTP ${res.status})`,
      };
    }

    if (!data?.foods?.length) {
      return {
        ok: false,
        error: data?.error ?? "AI 未能辨識食物，請手動輸入描述",
      };
    }

    return { ok: true, foods: data.foods, source: data.source };
  } catch (err) {
    console.warn("[meal-photo-detect-client] fetch failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "無法連線 AI 食物辨識",
    };
  }
}
