const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";

const OPENROUTER_VISION_FALLBACKS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "openai/gpt-4o-mini",
  "google/gemini-flash-1.5-8b",
] as const;

const SYSTEM_PROMPT = `你是一位專業的營養標籤 OCR 專家。請從相片中的營養標籤（或包裝）讀取：

產品資訊（每份）：
- product_name：產品名稱（中英文皆可，盡量從標籤標題或包裝讀取）
- brand：品牌（可選，無則空字串 ""）
- serving_weight_g：每份重量（克），標籤有寫才填，否則 0

營養數值（每份）：
- calories（熱量，kcal）
- protein（蛋白質，g）
- carbs（碳水化合物，g）
- fat（脂肪，g）
- sodium（鈉，mg）
- sugar（糖分，g）

若營養欄位缺失、模糊或無法辨識，該欄位設為 0。product_name 若完全無法辨識可填「包裝食品」。
你必須【絕對嚴格】只回傳一個合法 JSON 物件，不要使用 Markdown 標記，不要包含任何其他文字。
格式：{"product_name":"低糖乳酪","brand":"明治","serving_weight_g":120,"calories":250,"protein":10,"carbs":30,"fat":5,"sodium":400,"sugar":12}`;

export interface OcrNutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
  sugar: number;
}

export interface OcrNutritionResult extends OcrNutritionValues {
  productName: string;
  brand: string;
  servingWeightG: number;
  barcode?: string;
  offMatched?: boolean;
}

export class OcrNutritionError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "OcrNutritionError";
    this.status = status;
  }
}

export function getOpenRouterVisionModel(): string {
  return (
    process.env.OPENROUTER_VISION_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    DEFAULT_VISION_MODEL
  );
}

function getVisionModelCandidates(): string[] {
  const preferred = [
    process.env.OPENROUTER_VISION_MODEL?.trim(),
    process.env.OPENROUTER_MODEL?.trim(),
    DEFAULT_VISION_MODEL,
    ...OPENROUTER_VISION_FALLBACKS,
  ].filter((m): m is string => Boolean(m));
  return Array.from(new Set(preferred));
}

function getOpenRouterHeaders(apiKey: string): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk";
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer,
    "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "Nutrition Coach",
  };
}

function parseOpenRouterVisionContent(data: {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}): OcrNutritionResult {
  if (data.error?.message) {
    throw new OcrNutritionError(`OpenRouter: ${data.error.message}`, 502);
  }
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new OcrNutritionError("AI 未回傳標籤數據，請重新拍攝", 502);
  }
  return toOcrNutritionResult(parseOcrJson(content));
}

async function requestOpenRouterVision(
  model: string,
  dataUrl: string,
  apiKey: string
): Promise<OcrNutritionResult> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "請讀取這張營養標籤相片並回傳 JSON。" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.warn(
      `[ocr-nutrition] openrouter ${model} error`,
      res.status,
      detail.slice(0, 300)
    );
    throw new OcrNutritionError(
      res.status === 401 || res.status === 403
        ? "OpenRouter API 金鑰無效或未授權"
        : `OpenRouter ${model} 失敗 (${res.status})`,
      res.status === 429 ? 429 : 502
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  return parseOpenRouterVisionContent(data);
}

async function requestOpenAiVision(dataUrl: string): Promise<OcrNutritionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OcrNutritionError("OPENAI_API_KEY 未設定", 503);
  }
  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "請讀取這張營養標籤相片並回傳 JSON。" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.warn("[ocr-nutrition] openai error", res.status, detail.slice(0, 300));
    throw new OcrNutritionError(`OpenAI Vision 失敗 (${res.status})`, 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  return parseOpenRouterVisionContent(data);
}

export function isOcrNutritionConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function readMacro(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

export function normalizeImageBase64(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

function parseOcrJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function toOcrNutritionValues(raw: Record<string, unknown>): OcrNutritionValues {
  return {
    calories: readMacro(raw.calories),
    protein: readMacro(raw.protein),
    carbs: readMacro(raw.carbs),
    fat: readMacro(raw.fat ?? raw.fats),
    sodium: readMacro(raw.sodium ?? raw.sodium_mg ?? raw.sodiumMg),
    sugar: readMacro(raw.sugar ?? raw.sugar_g ?? raw.sugarG),
  };
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readServingWeightG(raw: Record<string, unknown>): number {
  const value =
    raw.serving_weight_g ?? raw.servingWeightG ?? raw.serving_g ?? raw.weight_g;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function toOcrNutritionResult(raw: Record<string, unknown>): OcrNutritionResult {
  const values = toOcrNutritionValues(raw);
  const productName =
    readText(raw.product_name ?? raw.productName ?? raw.food_name ?? raw.name) ||
    "包裝食品";
  const brand = readText(raw.brand);
  const servingWeightG = readServingWeightG(raw);
  return { ...values, productName, brand, servingWeightG };
}

export function isOcrResultEmpty(values: OcrNutritionValues): boolean {
  return (
    values.calories === 0 &&
    values.protein === 0 &&
    values.carbs === 0 &&
    values.fat === 0 &&
    values.sodium === 0 &&
    values.sugar === 0
  );
}

/** OpenRouter 多模型重試 + OpenAI Vision 後備 */
export async function scanNutritionLabel(
  imageBase64: string
): Promise<OcrNutritionResult> {
  const dataUrl = normalizeImageBase64(imageBase64);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey && !openAiKey) {
    throw new OcrNutritionError(
      "AI 營養標籤 OCR 尚未設定，請在 Vercel 加入 OPENROUTER_API_KEY 或 OPENAI_API_KEY",
      503
    );
  }

  if (apiKey) {
    for (const model of getVisionModelCandidates()) {
      try {
        return await requestOpenRouterVision(model, dataUrl, apiKey);
      } catch (err) {
        if (err instanceof OcrNutritionError && (err.status === 401 || err.status === 403)) {
          throw err;
        }
        console.warn(`[ocr-nutrition] ${model} skipped:`, err);
      }
    }
  }

  if (openAiKey) {
    try {
      return await requestOpenAiVision(dataUrl);
    } catch (err) {
      console.warn("[ocr-nutrition] openai fallback failed:", err);
      if (err instanceof OcrNutritionError) throw err;
    }
  }

  throw new OcrNutritionError(
    "AI 標籤辨識服務暫時不可用，請稍後再試",
    502
  );
}

/** @deprecated Use scanNutritionLabel */
export async function scanNutritionLabelWithOpenRouter(
  imageBase64: string
): Promise<OcrNutritionResult> {
  return scanNutritionLabel(imageBase64);
}
