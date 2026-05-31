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
    source: "openai",
  };
}

export async function searchFoodWithOpenAi(query: string): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new FoodSearchError(
      "AI 食物搜尋尚未設定，請聯絡管理員設定 OPENAI_API_KEY",
      503
    );
  }

  const systemPrompt =
    "你是一個精通香港飲食的營養資料庫。請根據用戶提供的食物名稱，估算標準一人份的營養素。你必須【只能】回傳 JSON 格式，絕對不能包含任何 Markdown 標籤 (例如 ```json) 或其他廢話。";

  const userPrompt = `請估算『${q}』。回傳格式：{"calories": 數字, "protein": 數字, "carbs": 數字, "fat": 數字, "weight_g": 數字}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[food-search-ai] OpenAI error", res.status, detail);
    throw new FoodSearchError("AI 分析失敗，請稍後再試", 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new FoodSearchError("AI 未回傳營養資料，請換個關鍵字再試", 502);
  }

  const parsed = parseAiJson(content, q);
  return [toSearchItem(parsed)];
}
