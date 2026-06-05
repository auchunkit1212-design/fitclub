import { NextResponse } from "next/server";
import {
  isOcrResultEmpty,
  OcrNutritionError,
  scanNutritionLabel,
} from "@/lib/ocr-nutrition";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as { imageBase64?: string; image?: string };
  const imageBase64 = (body.imageBase64 ?? body.image ?? "").trim();
  if (!imageBase64) {
    return NextResponse.json({ error: "請上傳標籤相片" }, { status: 400 });
  }

  try {
    const result = await scanNutritionLabel(imageBase64);
    if (isOcrResultEmpty(result)) {
      return NextResponse.json(
        { error: "標籤有點模糊，大猩猩看不清楚！請重新拍攝或手動輸入。", blur: true },
        { status: 422 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OcrNutritionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[ocr-nutrition]", error);
    return NextResponse.json({ error: "標籤辨識失敗" }, { status: 500 });
  }
}
