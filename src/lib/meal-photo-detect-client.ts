import { readApiJson } from "@/lib/api-client";
import type { AppLanguage } from "@/lib/i18n";
import type { DetectedMealFood } from "@/lib/meal-photo-detect";
import { getSessionRequestHeaders } from "@/lib/session";

export async function detectMealFoodsFromPhoto(
  imageBase64: string,
  lang: AppLanguage
): Promise<{ foods: DetectedMealFood[]; source?: string } | null> {
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

    if (!res.ok || parseError || !data?.foods?.length) {
      console.warn("[meal-photo-detect-client]", data?.error ?? res.status);
      return null;
    }

    return { foods: data.foods, source: data.source };
  } catch (err) {
    console.warn("[meal-photo-detect-client] fetch failed", err);
    return null;
  }
}
