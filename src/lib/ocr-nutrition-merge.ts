import type { OpenFoodFactsProduct } from "@/lib/open-food-facts";
import type { OcrNutritionResult } from "@/lib/ocr-nutrition";

function isGenericProductName(name: string): boolean {
  const trimmed = name.trim();
  return (
    !trimmed ||
    trimmed === "包裝食品" ||
    trimmed.length < 2
  );
}

function fillIfMissing(current: number, fallback: number): number {
  return current > 0 ? current : fallback;
}

/** 合併營養標籤 OCR、條碼同 Open Food Facts 資料（標籤營養優先） */
export function mergeLabelWithBarcodeLookup(
  label: OcrNutritionResult,
  barcode: string,
  off: OpenFoodFactsProduct | null
): OcrNutritionResult {
  const merged: OcrNutritionResult = {
    ...label,
    barcode,
    offMatched: Boolean(off && off.calories > 0),
  };

  if (!off) return merged;

  if (isGenericProductName(label.productName) && off.productName) {
    merged.productName = off.productName;
  }
  if (!label.brand.trim() && off.brand) {
    merged.brand = off.brand;
  }

  merged.calories = fillIfMissing(label.calories, off.calories);
  merged.protein = fillIfMissing(label.protein, off.protein);
  merged.carbs = fillIfMissing(label.carbs, off.carbs);
  merged.fat = fillIfMissing(label.fat, off.fats);
  merged.sodium = fillIfMissing(label.sodium, off.sodiumMg ?? 0);
  merged.sugar = fillIfMissing(label.sugar, off.sugarG ?? 0);

  if (label.servingWeightG <= 0 && off.servingWeightG && off.servingWeightG > 0) {
    merged.servingWeightG = off.servingWeightG;
  }

  return merged;
}
