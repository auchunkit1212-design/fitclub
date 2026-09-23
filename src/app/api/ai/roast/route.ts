import { NextResponse } from "next/server";
import { generateAiRoast } from "@/lib/ai-feedback";
import { normalizeLanguage } from "@/lib/i18n";
import { parseSessionFromRequest } from "@/lib/session-server";
import type { MealLog } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function readMacro(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function parseMeals(value: unknown): MealLog[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const m = row as Record<string, unknown>;
      const description = String(m.description ?? "").trim();
      const mealType = String(m.mealType ?? "").trim() || "餐食";
      if (!description) return null;
      return {
        id: String(m.id ?? ""),
        email: "",
        date: "",
        mealType,
        description,
        calories: readMacro(m.calories),
        protein: readMacro(m.protein),
        carbs: readMacro(m.carbs),
        fats: readMacro(m.fats),
        createdAt: "",
      } satisfies MealLog;
    })
    .filter((m): m is MealLog => m !== null);
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    meals?: unknown;
    targetCalories?: unknown;
    targetProtein?: unknown;
    targetCarbs?: unknown;
    targetFats?: unknown;
    lang?: string;
    studentName?: string;
  };

  const meals = parseMeals(body.meals);
  const lang = normalizeLanguage(body.lang);

  try {
    const result = await generateAiRoast({
      meals,
      targets: {
        calories: readMacro(body.targetCalories, 2000),
        protein: readMacro(body.targetProtein, 120),
        carbs: readMacro(body.targetCarbs, 200),
        fats: readMacro(body.targetFats, 65),
      },
      lang,
      studentName:
        typeof body.studentName === "string"
          ? body.studentName.trim()
          : session.name,
    });

    return NextResponse.json({
      roast: result.text,
      source: result.source,
    });
  } catch (err) {
    console.error("[api/ai/roast]", err);
    return NextResponse.json({ error: "AI 點評暫時不可用" }, { status: 502 });
  }
}
