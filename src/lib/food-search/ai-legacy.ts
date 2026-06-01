/**
 * 【封印備用】OpenAI / Gemini / 本地 AI 食物搜尋
 * 前端預設走 /api/food-search (FatSecret)；需要 AI 時改 call /api/food-search-ai
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { estimateFoodSearchMacros } from "@/lib/ai-mock";
import { getLanguageInstruction, type AppLanguage } from "@/lib/i18n";
import type { FoodSearchItem } from "@/lib/types";
import {
  FoodSearchError,
  parseAiJson,
  toFoodSearchItem,
  type AiFoodSearchResult,
} from "@/lib/food-search/shared";

export { FoodSearchError, type AiFoodSearchResult };

const GEMINI_SYSTEM_BASE =
  "你是一個精通香港飲食與各國料理的營養資料庫。請嚴格根據用戶提供的食物名稱，估算標準一人份的營養素。必須回傳 JSON。";

const OPENAI_SYSTEM_BASE =
  "你是一個精通香港飲食的營養資料庫。請根據用戶提供的食物名稱，估算標準一人份的營養素。你必須【只能】回傳 JSON 格式，絕對不能包含任何 Markdown 標籤 (例如 ```json) 或其他廢話。";

/** OpenAI GPT 估算（保留備用） */
export async function searchFoodWithOpenAi(
  query: string,
  lang: AppLanguage = "zh-HK"
): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new FoodSearchError(
      "AI 食物搜尋尚未設定，請聯絡管理員設定 OPENAI_API_KEY",
      503
    );
  }

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
        {
          role: "system",
          content: `${OPENAI_SYSTEM_BASE}\n${getLanguageInstruction(lang)}`,
        },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[food-search-ai-legacy] OpenAI error", res.status, detail);
    throw new FoodSearchError("AI 分析失敗，請稍後再試", 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  console.log("Raw AI Response:", data);
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new FoodSearchError("AI 未回傳營養資料，請換個關鍵字再試", 502);
  }

  return [toFoodSearchItem(parseAiJson(content, q), "openai")];
}

/** Google Gemini 估算（保留備用） */
export async function searchFoodWithGemini(
  query: string,
  lang: AppLanguage = "zh-HK"
): Promise<FoodSearchItem[]> {
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
      model: process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash",
      systemInstruction: `${GEMINI_SYSTEM_BASE}\n${getLanguageInstruction(lang)}`,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(userPrompt);
    const content = result.response.text();
    console.log("Raw AI Response:", {
      provider: "gemini",
      responseText: content,
    });
    if (!content.trim()) {
      throw new FoodSearchError("AI 未回傳營養資料，請換個關鍵字再試", 502);
    }

    return [toFoodSearchItem(parseAiJson(content, q), "gemini")];
  } catch (error) {
    if (error instanceof FoodSearchError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[food-search-ai-legacy] Gemini error", message);
    throw new FoodSearchError("AI 分析失敗，請稍後再試", 502);
  }
}

/** 本地規則估算（AI 路由 fallback，保留備用） */
export async function searchFoodLocally(
  query: string,
  _lang: AppLanguage = "zh-HK"
): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];
  const base = estimateFoodSearchMacros(q);
  return [
    toFoodSearchItem(
      {
        food_name: q,
        calories: base.calories,
        protein: base.protein,
        carbs: base.carbs,
        fat: base.fats,
        weight_g: 120,
      },
      "local"
    ),
  ];
}

/**
 * 統一 AI 入口（由 FOOD_SEARCH_AI_PROVIDER 控制：gemini | openai | local）
 */
export async function searchFoodWithAI(
  query: string,
  lang: AppLanguage = "zh-HK"
): Promise<FoodSearchItem[]> {
  const provider = (process.env.FOOD_SEARCH_AI_PROVIDER || "gemini").toLowerCase();
  if (provider === "openai") return searchFoodWithOpenAi(query, lang);
  if (provider === "local") return searchFoodLocally(query, lang);
  return searchFoodWithGemini(query, lang);
}
