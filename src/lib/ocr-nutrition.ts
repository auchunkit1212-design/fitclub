const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_VISION_MODEL = "google/gemini-2.0-flash";

const SYSTEM_PROMPT = `你是一位專業的營養標籤 OCR 專家。請從相片中的營養標籤讀取以下數值（每份）：
- calories（熱量，kcal）
- protein（蛋白質，g）
- carbs（碳水化合物，g）
- fat（脂肪，g）
- sodium（鈉，mg）
- sugar（糖分，g）

若欄位缺失、模糊或無法辨識，該欄位設為 0。
你必須【絕對嚴格】只回傳一個合法 JSON 物件，不要使用 Markdown 標記，不要包含任何其他文字。
格式：{"calories": 250, "protein": 10, "carbs": 30, "fat": 5, "sodium": 400, "sugar": 12}`;

export interface OcrNutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
  sugar: number;
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

export async function scanNutritionLabelWithOpenRouter(
  imageBase64: string
): Promise<OcrNutritionValues> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new OcrNutritionError(
      "AI 營養標籤 OCR 尚未設定，請在環境變數加入 OPENROUTER_API_KEY",
      503
    );
  }

  const model = getOpenRouterVisionModel();
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk";
  const dataUrl = normalizeImageBase64(imageBase64);

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
      temperature: 0.1,
      max_tokens: 400,
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
    console.error("[ocr-nutrition] openrouter error", res.status, detail.slice(0, 500));
    throw new OcrNutritionError(
      res.status === 401 || res.status === 403
        ? "OpenRouter API 金鑰無效或未授權"
        : "AI 標籤辨識服務暫時不可用，請稍後再試",
      res.status === 429 ? 429 : 502
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new OcrNutritionError(`OpenRouter: ${data.error.message}`, 502);
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new OcrNutritionError("AI 未回傳標籤數據，請重新拍攝", 502);
  }

  return toOcrNutritionValues(parseOcrJson(content));
}
