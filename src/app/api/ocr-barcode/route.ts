import { NextResponse } from "next/server";
import { scanBarcodeFromImage } from "@/lib/barcode-scan";
import { mergeLabelWithBarcodeLookup } from "@/lib/ocr-nutrition-merge";
import {
  isOcrResultEmpty,
  OcrNutritionError,
  type OcrNutritionResult,
} from "@/lib/ocr-nutrition";
import { lookupOpenFoodFacts } from "@/lib/open-food-facts";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseLabelResult(value: unknown): OcrNutritionResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const productName = String(raw.productName ?? raw.product_name ?? "").trim();
  if (!productName) return null;

  const readMacro = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };

  return {
    productName,
    brand: String(raw.brand ?? "").trim(),
    servingWeightG: readMacro(raw.servingWeightG ?? raw.serving_weight_g),
    calories: readMacro(raw.calories),
    protein: readMacro(raw.protein),
    carbs: readMacro(raw.carbs),
    fat: readMacro(raw.fat ?? raw.fats),
    sodium: readMacro(raw.sodium),
    sugar: readMacro(raw.sugar),
  };
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    imageBase64?: string;
    image?: string;
    labelResult?: unknown;
  };

  const imageBase64 = (body.imageBase64 ?? body.image ?? "").trim();
  if (!imageBase64) {
    return NextResponse.json({ error: "請上傳條碼相片" }, { status: 400 });
  }

  const labelResult = parseLabelResult(body.labelResult);
  if (!labelResult) {
    return NextResponse.json(
      { error: "請先完成第 1 步：拍攝營養標籤" },
      { status: 400 }
    );
  }

  try {
    const barcodeScan = await scanBarcodeFromImage(imageBase64);
    const off = await lookupOpenFoodFacts(barcodeScan.barcode);
    const merged = mergeLabelWithBarcodeLookup(
      labelResult,
      barcodeScan.barcode,
      off
    );

    if (isOcrResultEmpty(merged)) {
      return NextResponse.json(
        {
          error:
            "條碼已讀取，但營養資料不足。請重新拍攝標籤或手動輸入。",
          barcode: barcodeScan.barcode,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ...merged,
      barcodeFormat: barcodeScan.format,
      offFound: Boolean(off),
    });
  } catch (error) {
    if (error instanceof OcrNutritionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[ocr-barcode]", error);
    return NextResponse.json({ error: "條碼辨識失敗" }, { status: 500 });
  }
}
