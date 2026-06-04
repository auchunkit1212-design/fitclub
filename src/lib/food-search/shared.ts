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

function normalizeAiFoodRow(
  parsed: Partial<AiFoodSearchResult & { fats?: number; food_name?: string }>,
  fallbackName: string
): AiFoodSearchResult {
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
    throw new FoodSearchError("AI 回應缺少有效營養數值", 502);
  }

  const food_name = String(parsed.food_name ?? fallbackName).trim() || fallbackName;
  if (!food_name) {
    throw new FoodSearchError("AI 回應缺少食物名稱", 502);
  }

  return {
    food_name,
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    weight_g: Math.round(Number.isFinite(weight_g) ? weight_g : 0),
  };
}

/** Parse a JSON array of food suggestions from LLM output */
export function parseAiJsonArray(raw: string, query: string): AiFoodSearchResult[] {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonText = fenced ? fenced[1].trim() : trimmed;

  const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonText = arrayMatch[0];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new FoodSearchError(
      "AI 回應格式錯誤，無法解析聯想列表，請換個關鍵字再試",
      502
    );
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const results: AiFoodSearchResult[] = [];

  for (const row of rows.slice(0, 5)) {
    if (!row || typeof row !== "object") continue;
    try {
      results.push(
        normalizeAiFoodRow(row as Partial<AiFoodSearchResult & { fats?: number }>, query)
      );
    } catch {
      // skip invalid rows
    }
  }

  if (results.length === 0) {
    throw new FoodSearchError("AI 未回傳有效食物選項，請換個關鍵字再試", 502);
  }

  return results;
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

  return normalizeAiFoodRow(parsed, query);
}
