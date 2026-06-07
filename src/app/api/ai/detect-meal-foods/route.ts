import { NextResponse } from "next/server";
import {
  detectFoodsFromMealPhoto,
  MealPhotoDetectError,
} from "@/lib/meal-photo-detect";
import { normalizeLanguage } from "@/lib/i18n";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    imageBase64?: string;
    image?: string;
    lang?: string;
  };

  const imageBase64 = (body.imageBase64 ?? body.image ?? "").trim();
  if (!imageBase64) {
    return NextResponse.json({ error: "請提供食物相片" }, { status: 400 });
  }

  const lang = normalizeLanguage(body.lang);

  try {
    const result = await detectFoodsFromMealPhoto(imageBase64, lang);
    return NextResponse.json({
      foods: result.foods,
      source: result.source,
      count: result.foods.length,
    });
  } catch (err) {
    if (err instanceof MealPhotoDetectError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/ai/detect-meal-foods]", err);
    return NextResponse.json({ error: "AI 食物辨識失敗" }, { status: 502 });
  }
}
