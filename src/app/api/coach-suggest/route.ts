import { NextResponse } from "next/server";
import { generateCoachMealSuggestion } from "@/lib/coach-suggest";
import { normalizeLanguage } from "@/lib/i18n";
import { parseSessionFromRequest } from "@/lib/session-server";
import { assertProSession, ProRequiredError } from "@/lib/user-plan";

function readMacro(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  try {
    await assertProSession(session);
  } catch (err) {
    if (err instanceof ProRequiredError) {
      return NextResponse.json(
        { error: "AI 推薦菜單僅供 Pro 會員", code: "PRO_REQUIRED" },
        { status: 403 }
      );
    }
    throw err;
  }

  const body = (await request.json()) as {
    targetCalories?: unknown;
    targetProtein?: unknown;
    targetCarbs?: unknown;
    targetFats?: unknown;
    consumedCalories?: unknown;
    consumedProtein?: unknown;
    consumedCarbs?: unknown;
    consumedFats?: unknown;
    craving?: string;
    lang?: string;
    mealsLoggedToday?: unknown;
    regenerate?: boolean;
    avoidTitles?: unknown;
  };

  const targets = {
    calories: readMacro(body.targetCalories, 2000),
    protein: readMacro(body.targetProtein, 120),
    carbs: readMacro(body.targetCarbs, 200),
    fats: readMacro(body.targetFats, 65),
  };

  const consumed = {
    calories: readMacro(body.consumedCalories),
    protein: readMacro(body.consumedProtein),
    carbs: readMacro(body.consumedCarbs),
    fats: readMacro(body.consumedFats),
  };

  const craving =
    typeof body.craving === "string" ? body.craving.trim().slice(0, 80) : "";
  const lang = normalizeLanguage(body.lang);
  const regenerate = body.regenerate === true;
  const avoidTitles = Array.isArray(body.avoidTitles)
    ? body.avoidTitles
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean)
        .slice(0, 12)
    : [];

  try {
    const mealsLoggedToday = readMacro(body.mealsLoggedToday);

    const result = await generateCoachMealSuggestion({
      targets,
      consumed,
      craving,
      lang,
      mealsLoggedToday,
      regenerate,
      avoidTitles,
    });

    return NextResponse.json({
      suggestion_text: result.suggestion_text,
      tags: result.tags,
      rest_of_day_meals: result.rest_of_day_meals,
      mode: result.mode,
      remaining: result.remaining,
    });
  } catch (error) {
    console.error("[coach-suggest]", error);
    return NextResponse.json({ error: "教練建議生成失敗" }, { status: 500 });
  }
}
