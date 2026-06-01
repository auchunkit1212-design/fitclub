import type { FoodSearchItem } from "@/lib/types";

export interface AiFoodSearchResult {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight_g: number;
}

export class FoodSearchError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "FoodSearchError";
    this.statusCode = statusCode;
  }
}

export function toFoodSearchItem(
  result: AiFoodSearchResult,
  source: FoodSearchItem["source"]
): FoodSearchItem {
  return {
    id: `${source}-${Date.now()}-${result.food_name.slice(0, 12)}`,
    name: result.food_name,
    brand: "",
    calories: result.calories,
    protein: result.protein,
    carbs: result.carbs,
    fats: result.fat,
    weightG: result.weight_g,
    servingLabel: result.weight_g > 0 ? `約 ${result.weight_g}g` : "標準一人份",
    source,
  };
}

export function parseAiJson(raw: string, query: string): AiFoodSearchResult {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  let parsed: Partial<AiFoodSearchResult & { fats?: number }>;
  try {
    parsed = JSON.parse(jsonText) as Partial<AiFoodSearchResult & { fats?: number }>;
  } catch {
    throw new FoodSearchError("AI 回應格式錯誤，無法解析營養資料，請換個關鍵字再試", 502);
  }

  const calories = Number(parsed.calories);
  const protein = Number(parsed.protein);
  const carbs = Number(parsed.carbs);
  const fat = Number(parsed.fat ?? parsed.fats);
  const weight_g = Number(parsed.weight_g);

  if (
    !Number.isFinite(calories) ||
    !Number.isFinite(protein) ||
    !Number.isFinite(carbs) ||
    !Number.isFinite(fat) ||
    calories <= 0
  ) {
    throw new FoodSearchError("AI 回應缺少有效營養數值，請換個關鍵字再試", 502);
  }

  return {
    food_name: String(parsed.food_name ?? query).trim() || query,
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    weight_g: Math.round(Number.isFinite(weight_g) ? weight_g : 0),
  };
}
