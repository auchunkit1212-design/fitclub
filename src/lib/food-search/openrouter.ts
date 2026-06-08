import { getLanguageInstruction, type AppLanguage } from "@/lib/i18n";
import type { FoodSearchItem } from "@/lib/types";
import {
  FoodSearchError,
  parseAiJsonArray,
  toFoodSearchItem,
} from "@/lib/food-search/shared";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODEL = "deepseek/deepseek-chat";
const DEFAULT_AUTOCOMPLETE_MODEL = "meta-llama/llama-4-scout";

const FAST_AUTOCOMPLETE_SYSTEM_PROMPT = `你是營養學食物聯想 API。用戶輸入未完成、錯別字或中英夾雜的食物名稱，請聯想 3 個最可能選項（含香港／台灣地道飲食）。
每項估算標準一人份營養（整數）：calories、protein、carbs、fat、weight_g；可選 fiber、sugar、saturated_fat、sodium_mg、cholesterol_mg。
只回傳合法 JSON Array，不要 Markdown，不要其他文字。
格式：[{"food_name":"茶走","calories":95,"protein":3,"carbs":8,"fat":5,"weight_g":350}]`;

const AUTOCOMPLETE_SYSTEM_PROMPT = `你是一個極度專業的營養學 API 伺服器（Pro 級微量營養分析）。用戶會輸入未完成的拼音、錯別字或中英夾雜的食物名稱，請你自動推斷他們想找的食物，並聯想出 5 個最可能的選項（必須包含香港與台灣的地道飲食，亦可包含合理的國際常見食物）。
每個選項請估算【標準一人份】的完整營養素（整數），包含宏量與進階微量營養素。
你必須【絕對嚴格】地只回傳一個合法的 JSON Array，不要使用 Markdown 標記 (如 \`\`\`json)，不要包含任何其他文字。
格式範例（每個物件必須包含以下所有欄位）：
[{"food_name": "Hot Chocolate (Drink)", "calories": 250, "protein": 5, "carbs": 30, "fat": 10, "weight_g": 250, "fiber": 2, "sugar": 25, "saturated_fat": 6, "sodium_mg": 150, "cholesterol_mg": 15}, {"food_name": "茶走", "calories": 95, "protein": 3, "carbs": 8, "fat": 5, "weight_g": 350, "fiber": 0, "sugar": 7, "saturated_fat": 3, "sodium_mg": 45, "cholesterol_mg": 12}]
欄位說明：fiber=膳食纖維(g)、sugar=糖分(g)、saturated_fat=飽和脂肪(g)、sodium_mg=鈉(mg)、cholesterol_mg=膽固醇(mg)。
飲品注意：200ml 全脂鮮奶約 120–135 kcal（蛋白 ~7g、碳水 ~10g、脂肪 ~7g、鈉 ~100mg），勿與公仔麵或正餐混淆。
若用戶一次輸入多樣食物（用 +、，、加 等連接），請把每項分開估算後加總，勿只按其中一個關鍵字（例如只算咖啡）。`;

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

/** 食物搜尋 autocomplete 用較快模型（可獨立於 OPENROUTER_MODEL） */
export function getOpenRouterAutocompleteModel(): string {
  return (
    process.env.OPENROUTER_AUTOCOMPLETE_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    DEFAULT_AUTOCOMPLETE_MODEL
  );
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

/** 脫敏顯示 key 格式，方便核對 Vercel 是否載入正確 env */
export function getOpenRouterKeyHint(): {
  length: number;
  prefix: string;
  looksValid: boolean;
} {
  const raw = process.env.OPENROUTER_API_KEY ?? "";
  const key = raw.trim();
  const prefix = key.slice(0, 12);
  return {
    length: key.length,
    prefix: prefix ? `${prefix}…` : "(empty)",
    looksValid: key.startsWith("sk-or-v1-") && key.length >= 40,
  };
}

export function getOpenRouterReferer(): string {
  return (
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk"
  );
}

function sanitizeOpenRouterDetail(detail: string): string {
  const trimmed = detail.trim().slice(0, 400);
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string; code?: number | string };
      message?: string;
    };
    const message =
      parsed.error?.message?.trim() ||
      parsed.message?.trim() ||
      trimmed;
    return message.slice(0, 300);
  } catch {
    return trimmed.slice(0, 300);
  }
}

export function mapOpenRouterHttpError(status: number, detail = ""): {
  message: string;
  hint: string;
  statusCode: number;
} {
  const sanitized = sanitizeOpenRouterDetail(detail);
  const detailSuffix = sanitized ? `（${sanitized}）` : "";

  switch (status) {
    case 401:
    case 403:
      return {
        message: "OpenRouter API 金鑰無效或未授權",
        hint: "請到 Vercel 檢查 OPENROUTER_API_KEY 是否正確，並重新部署",
        statusCode: status,
      };
    case 402:
      return {
        message: `OpenRouter 帳戶餘額不足${detailSuffix}`,
        hint: "請到 openrouter.ai 儲值或提高 credit limit",
        statusCode: 402,
      };
    case 429:
      return {
        message: `OpenRouter 請求過於頻繁，請稍後再試${detailSuffix}`,
        hint: "稍等 1–2 分鐘後重試，或檢查 OpenRouter rate limit",
        statusCode: 429,
      };
    case 404:
      return {
        message: `OpenRouter 找不到模型${detailSuffix}`,
        hint: "請檢查 OPENROUTER_MODEL 是否有效（例如 deepseek/deepseek-chat）",
        statusCode: 404,
      };
    case 400:
      return {
        message: `OpenRouter 請求格式錯誤${detailSuffix}`,
        hint: "請檢查模型名稱與 HTTP-Referer 設定",
        statusCode: 400,
      };
    default:
      return {
        message: `AI 聯想服務暫時不可用（HTTP ${status}）${detailSuffix}`,
        hint: "請查看 Vercel Function Logs 或 OpenRouter 控制台",
        statusCode: status >= 500 ? 502 : status,
      };
  }
}

async function openRouterChatRequest(
  body: Record<string, unknown>,
  options?: { timeoutMs?: number }
): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new FoodSearchError(
      "AI 食物搜尋尚未設定，請在環境變數加入 OPENROUTER_API_KEY",
      503
    );
  }

  const timeoutMs = options?.timeoutMs;
  const signal =
    timeoutMs && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

  try {
    return await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": getOpenRouterReferer(),
        "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "Nutrition Coach",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new FoodSearchError("AI 聯想逾時，請稍後再試或使用本地關鍵字", 504);
    }
    throw err;
  }
}

export type OpenRouterPingResult = {
  ok: boolean;
  httpStatus?: number;
  error?: string;
  hint?: string;
  detail?: string;
  referer: string;
};

/** 輕量連線測試：只驗證金鑰、餘額、模型是否可用 */
export async function pingOpenRouter(): Promise<OpenRouterPingResult> {
  const referer = getOpenRouterReferer();
  const model = getOpenRouterModel();

  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      error: "OPENROUTER_API_KEY not set",
      hint: "請在 Vercel 設定 OPENROUTER_API_KEY",
      referer,
    };
  }

  const res = await openRouterChatRequest({
    model,
    temperature: 0,
    max_tokens: 8,
    messages: [{ role: "user", content: "ping" }],
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[openrouter] ping error", res.status, detail.slice(0, 500));
    const mapped = mapOpenRouterHttpError(res.status, detail);
    return {
      ok: false,
      httpStatus: res.status,
      error: mapped.message,
      hint: mapped.hint,
      detail: sanitizeOpenRouterDetail(detail) || undefined,
      referer,
    };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    return {
      ok: false,
      httpStatus: 502,
      error: `OpenRouter: ${data.error.message}`,
      hint: "請檢查模型名稱與帳戶權限",
      referer,
    };
  }

  return { ok: true, httpStatus: res.status, referer };
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

  const model = getOpenRouterAutocompleteModel();

  const userMessage = `用戶輸入：「${q}」
請聯想 3 個最可能的食物並估算營養素。${getLanguageInstruction(lang)}`;

  const res = await openRouterChatRequest(
    {
      model,
      temperature: 0.25,
      max_tokens: 550,
      messages: [
        { role: "system", content: FAST_AUTOCOMPLETE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    },
    { timeoutMs: 8_000 }
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("[openrouter] chat error", res.status, detail.slice(0, 500));
    const mapped = mapOpenRouterHttpError(res.status, detail);
    throw new FoodSearchError(mapped.message, mapped.statusCode);
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
  httpStatus?: number;
  hint?: string;
  detail?: string;
  referer?: string;
  pingOk?: boolean;
};

export async function diagnoseOpenRouter(): Promise<OpenRouterDiagnostics> {
  const configured = isOpenRouterConfigured();
  const model = getOpenRouterModel();
  const referer = getOpenRouterReferer();

  if (!configured) {
    return {
      configured: false,
      model,
      ok: false,
      error: "OPENROUTER_API_KEY not set",
      hint: "請在 Vercel 設定 OPENROUTER_API_KEY",
      referer,
    };
  }

  const ping = await pingOpenRouter();
  if (!ping.ok) {
    return {
      configured: true,
      model,
      ok: false,
      pingOk: false,
      httpStatus: ping.httpStatus,
      error: ping.error,
      hint: ping.hint,
      detail: ping.detail,
      referer: ping.referer,
    };
  }

  try {
    const items = await searchFoodWithOpenRouter("茶", "zh-HK");
    return {
      configured: true,
      model,
      ok: items.length > 0,
      pingOk: true,
      sampleCount: items.length,
      httpStatus: ping.httpStatus,
      referer,
    };
  } catch (err) {
    return {
      configured: true,
      model,
      ok: false,
      pingOk: true,
      httpStatus:
        err instanceof FoodSearchError ? err.statusCode : ping.httpStatus,
      error: err instanceof Error ? err.message : "diagnostics failed",
      hint:
        err instanceof FoodSearchError && err.statusCode === 502
          ? "連線正常但 AI 回應無法解析，請檢查模型輸出"
          : "食物聯想測試失敗，請查看 Vercel logs",
      referer,
    };
  }
}
