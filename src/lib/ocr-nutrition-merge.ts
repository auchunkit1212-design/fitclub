import type { OpenFoodFactsProduct } from "@/lib/open-food-facts";
import type { OcrNutritionResult } from "@/lib/ocr-nutrition";

function isGenericProductName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return true;
  const generics = new Set([
    "包裝食品",
    "食品",
    "飲品",
    "豆奶",
    "豆漿",
    "牛奶",
    "飲料",
    "product",
    "food",
    "drink",
    "soya milk",
    "soy milk",
    "milk",
  ]);
  return generics.has(trimmed.toLowerCase());
}

function fillIfMissing(current: number, fallback: number): number {
  return current > 0 ? current : fallback;
}

/**
 * 合併營養標籤 OCR、條碼同 Open Food Facts。
 * 原則：標籤已讀到嘅名稱／macros【永遠優先】；OFF 只補缺漏，唔好蓋過。
 */
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

  // 名稱：只有標籤係空／泛稱先用 OFF；唔好用英文泛稱蓋過中文產品名
  if (isGenericProductName(label.productName) && off.productName) {
    if (!isGenericProductName(off.productName)) {
      merged.productName = off.productName;
    }
  }
  if (!label.brand.trim() && off.brand) {
    merged.brand = off.brand;
  }

  // macros：標籤有值就鎖定，OFF 只填 0
  merged.calories = fillIfMissing(label.calories, off.calories);
  merged.protein = fillIfMissing(label.protein, off.protein);
  merged.carbs = fillIfMissing(label.carbs, off.carbs);
  merged.fat = fillIfMissing(label.fat, off.fats);
  merged.sodium = fillIfMissing(label.sodium, off.sodiumMg ?? 0);
  merged.sugar = fillIfMissing(label.sugar, off.sugarG ?? 0);

  // 標籤已有營養時，唔好硬套 OFF serving 克數（100ml vs 250ml 基準會錯）
  const labelHasMacros =
    label.calories > 0 ||
    label.protein > 0 ||
    label.carbs > 0 ||
    label.fat > 0;
  if (
    label.servingWeightG <= 0 &&
    !labelHasMacros &&
    off.servingWeightG &&
    off.servingWeightG > 0
  ) {
    merged.servingWeightG = off.servingWeightG;
  }

  return merged;
}
