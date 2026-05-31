import { estimateMacros } from "@/lib/ai-mock";
import type { FoodSearchItem } from "@/lib/types";

export interface AiFoodSearchResult {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight_g: number;
}

function parseAiJson(raw: string): AiFoodSearchResult | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(jsonText) as Partial<AiFoodSearchResult>;
    if (!parsed.food_name || typeof parsed.calories !== "number") return null;
    return {
      food_name: String(parsed.food_name),
      calories: Math.round(Number(parsed.calories) || 0),
      protein: Math.round(Number(parsed.protein) || 0),
      carbs: Math.round(Number(parsed.carbs) || 0),
      fat: Math.round(Number(parsed.fat) || 0),
      weight_g: Math.round(Number(parsed.weight_g) || 0),
    };
  } catch {
    return null;
  }
}

function mockSearchResult(query: string): FoodSearchItem {
  const est = estimateMacros(query, "中拳", "中掌", "有");
  return {
    id: `mock-${Date.now()}`,
    name: query.trim(),
    brand: "",
    calories: est.calories,
    protein: est.protein,
    carbs: est.carbs,
    fats: est.fats,
    weightG: 350,
    servingLabel: "標準一人份",
    source: "mock",
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
    return [mockSearchResult(q)];
  }

  const userPrompt = `你是一位精通香港地道飲食與各國料理的營養師。請針對使用者搜尋的食物「${q}」，估算其標準一人份分量的：熱量 (Calories)、蛋白質 (Protein)、碳水化合物 (Carbs)、脂肪 (Fat) 以及預估重量(克)。請嚴格以 JSON 格式回傳，格式如：{ "food_name": "...", "calories": 450, "protein": 25, "carbs": 50, "fat": 15, "weight_g": 350 }`;

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
        {
          role: "system",
          content:
            "你是香港飲食營養估算專家。只回傳單一 JSON 物件，不要 markdown，不要額外文字。外食必須計入隱形熱量（湯底、用油、醬汁）。",
        },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[food-search-ai] OpenAI error", res.status, await res.text());
    return [mockSearchResult(q)];
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseAiJson(content);
  if (!parsed || parsed.calories <= 0) {
    return [mockSearchResult(q)];
  }

  return [toSearchItem(parsed)];
}
