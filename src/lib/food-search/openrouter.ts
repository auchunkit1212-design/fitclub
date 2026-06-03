import { getLanguageInstruction, type AppLanguage } from "@/lib/i18n";
import type { FoodSearchItem } from "@/lib/types";
import {
  FoodSearchError,
  parseAiJsonArray,
  toFoodSearchItem,
} from "@/lib/food-search/shared";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODEL = "google/gemini-2.5-flash";

const AUTOCOMPLETE_SYSTEM_PROMPT = `你是一個極度專業的營養學 API 伺服器。用戶會輸入未完成的拼音、錯別字或中英夾雜的食物名稱，請你自動推斷他們想找的食物，並聯想出 5 個最可能的選項（必須包含香港與台灣的地道飲食，亦可包含合理的國際常見食物）。
每個選項請估算標準一人份的營養素（整數）。
你必須【絕對嚴格】地只回傳一個合法的 JSON Array，不要使用 Markdown 標記 (如 \`\`\`json)，不要包含任何其他文字。
格式範例：[{"food_name": "Hot Chocolate (Drink)", "calories": 250, "protein": 5, "carbs": 30, "fat": 10, "weight_g": 250}, {"food_name": "茶走", "calories": 95, "protein": 3, "carbs": 8, "fat": 5, "weight_g": 350}]`;

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function searchFoodWithOpenRouter(
  query: string,
  lang: AppLanguage = "zh-HK"
): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new FoodSearchError(
      "AI 食物搜尋尚未設定，請在環境變數加入 OPENROUTER_API_KEY",
      503
    );
  }

  const model = getOpenRouterModel();
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk";

  const userMessage = `用戶輸入（可能未完成、含錯字或中英夾雜）：「${q}」
請聯想 5 個最可能的食物選項並估算營養素。${getLanguageInstruction(lang)}`;

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "Nutrition Coach",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 900,
      messages: [
        { role: "system", content: AUTOCOMPLETE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[openrouter] chat error", res.status, detail.slice(0, 500));
    throw new FoodSearchError(
      res.status === 401 || res.status === 403
        ? "OpenRouter API 金鑰無效或未授權"
        : "AI 聯想服務暫時不可用，請稍後再試",
      res.status === 429 ? 429 : 502
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new FoodSearchError(`OpenRouter: ${data.error.message}`, 502);
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new FoodSearchError("AI 未回傳聯想結果，請換個關鍵字再試", 502);
  }

  const rows = parseAiJsonArray(content, q);
  return rows.map((row, i) => {
    const item = toFoodSearchItem(row, "openrouter");
    const slug = row.food_name.replace(/\s+/g, "-").slice(0, 24);
    item.id = `openrouter-${slug}-${i}`;
    return item;
  });
}

export type OpenRouterDiagnostics = {
  configured: boolean;
  model: string;
  ok: boolean;
  sampleCount?: number;
  error?: string;
};

export async function diagnoseOpenRouter(): Promise<OpenRouterDiagnostics> {
  const configured = isOpenRouterConfigured();
  const model = getOpenRouterModel();
  if (!configured) {
    return {
      configured: false,
      model,
      ok: false,
      error: "OPENROUTER_API_KEY not set",
    };
  }

  try {
    const items = await searchFoodWithOpenRouter("茶", "zh-HK");
    return {
      configured: true,
      model,
      ok: items.length > 0,
      sampleCount: items.length,
    };
  } catch (err) {
    return {
      configured: true,
      model,
      ok: false,
      error: err instanceof Error ? err.message : "diagnostics failed",
    };
  }
}
