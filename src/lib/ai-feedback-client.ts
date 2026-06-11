import { generateCoachReport, generateRoast } from "@/lib/ai-mock";
import { readApiJson } from "@/lib/api-client";
import type { AppLanguage } from "@/lib/i18n";
import { getSessionRequestHeaders } from "@/lib/session";
import type { MealLog } from "@/lib/types";

type MealSummary = Pick<
  MealLog,
  "mealType" | "description" | "calories" | "protein" | "carbs" | "fats"
>;

export async function fetchAiRoast(input: {
  meals: MealSummary[];
  targetCalories: number;
  targetProtein: number;
  lang: AppLanguage;
  studentName?: string;
}): Promise<string> {
  const fallback = generateRoast(
    input.meals.reduce((s, m) => s + m.calories, 0),
    input.targetCalories,
    input.meals.reduce((s, m) => s + m.protein, 0),
    input.targetProtein,
    input.lang,
    input.meals
  );

  try {
    const res = await fetch("/api/ai/roast", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getSessionRequestHeaders(),
      },
      body: JSON.stringify({
        meals: input.meals,
        targetCalories: input.targetCalories,
        targetProtein: input.targetProtein,
        lang: input.lang,
        studentName: input.studentName,
      }),
    });
    const { data } = await readApiJson<{ roast?: string }>(res);
    if (res.ok && data?.roast?.trim()) {
      return data.roast.trim();
    }
  } catch (err) {
    console.warn("[ai-feedback-client] roast fetch failed", err);
  }

  return fallback;
}

export async function fetchAiCoachReport(input: {
  logs: MealLog[];
  lang?: AppLanguage;
  gymName?: string;
  studentName?: string;
}): Promise<string> {
  const fallback = generateCoachReport(input.logs, input.studentName);

  try {
    const res = await fetch("/api/ai/coach-report", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getSessionRequestHeaders(),
      },
      body: JSON.stringify({
        logs: input.logs,
        lang: input.lang,
        gymName: input.gymName,
        studentName: input.studentName,
      }),
    });
    const { data } = await readApiJson<{ report?: string }>(res);
    if (res.ok && data?.report?.trim()) {
      return data.report.trim();
    }
  } catch (err) {
    console.warn("[ai-feedback-client] coach report fetch failed", err);
  }

  return fallback;
}
