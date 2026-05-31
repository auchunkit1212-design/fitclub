import { GoogleGenerativeAI } from "@google/generative-ai";
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

const SYSTEM_INSTRUCTION =
  "你是一個精通香港飲食與各國料理的營養資料庫。請嚴格根據用戶提供的食物名稱，估算標準一人份的營養素。必須回傳 JSON。";

function parseAiJson(raw: string, query: string): AiFoodSearchResult {
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

function toSearchItem(result: AiFoodSearchResult): FoodSearchItem {
  return {
    id: `ai-${Date.now()}-${result.food_name.slice(0, 12)}`,
    name: result.food_name,
    brand: "",
    calories: result.calories,
    protein: result.protein,
    carbs: result.carbs,
    fats: result.fat,
    weightG: result.weight_g,
    servingLabel: result.weight_g > 0 ? `約 ${result.weight_g}g` : "標準一人份",
    source: "gemini",
  };
}

export async function searchFoodWithGemini(query: string): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new FoodSearchError(
      "AI 尚未設定，請聯絡管理員在環境變數加入 GEMINI_API_KEY",
      500
    );
  }

  const userPrompt = `請估算『${q}』。回傳 JSON 格式必須為：{"calories": 數字, "protein": 數字, "carbs": 數字, "fat": 數字, "weight_g": 數字}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(userPrompt);
    const content = result.response.text();
    if (!content.trim()) {
      throw new FoodSearchError("AI 未回傳營養資料，請換個關鍵字再試", 502);
    }

    const parsed = parseAiJson(content, q);
    return [toSearchItem(parsed)];
  } catch (error) {
    if (error instanceof FoodSearchError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[food-search-ai] Gemini error", message);
    throw new FoodSearchError("AI 分析失敗，請稍後再試", 502);
  }
}
