import { NextResponse } from "next/server";
import {
  MealAiEstimateError,
  verifyMealNutrition,
  type MealBaselineSource,
} from "@/lib/meal-ai-verify";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    description?: string;
    baseline?: {
      calories?: number;
      protein?: number;
      carbs?: number;
      fats?: number;
    };
    advanced?: {
      fiberG?: number;
      sugarG?: number;
      saturatedFatG?: number;
      sodiumMg?: number;
      cholesterolMg?: number;
    };
    imageBase64?: string;
    baselineSource?: MealBaselineSource;
  };

  const description = body.description?.trim() ?? "";
  if (!description) {
    return NextResponse.json({ error: "請填寫食物描述" }, { status: 400 });
  }

  const baselineCal = Number(body.baseline?.calories);
  const baseline =
    Number.isFinite(baselineCal) && baselineCal >= 0
      ? {
          calories: Math.round(baselineCal),
          protein: Math.round(Number(body.baseline?.protein) || 0),
          carbs: Math.round(Number(body.baseline?.carbs) || 0),
          fats: Math.round(Number(body.baseline?.fats) || 0),
        }
      : undefined;

  try {
    const result = await verifyMealNutrition({
      description,
      baseline,
      advanced: body.advanced,
      imageBase64: body.imageBase64?.trim() || undefined,
      baselineSource: body.baselineSource,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof MealAiEstimateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const readable = toReadableError(error, "AI 估算失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}
