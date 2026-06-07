import { getLanguageInstruction, type AppLanguage } from "@/lib/i18n";
import {
  getOpenRouterVisionModel,
  normalizeImageBase64,
} from "@/lib/ocr-nutrition";
import { isOpenRouterConfigured } from "@/lib/food-search/openrouter";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_VISION_FALLBACKS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "openai/gpt-4o-mini",
] as const;

const SYSTEM_PROMPT = `你是香港飲食視覺辨識專家。從食物相片中辨識【所有可見的獨立食物項目】。

每項食物估算【相片中可見的一份／一碟／一碗／一塊】的標準營養（整數 kcal 與 g）。

規則：
1. 必須分開每一樣獨立食物，不可 merge 成「一份餐」。
2. 若只得一樣食物，仍回傳只有一項的陣列。
3. name 用繁體中文（香港慣用語），具體到菜式（例如「白飯」「去皮雞胸」「炒通菜」）。
4. base_weight_g：估算可見一份重量（克），唔肯定填 0。
5. portion_hint：描述可見份量（例如「一碟」「一碗」「一塊」「半隻」）。
6. 外食要計入隱形熱量（油、湯底、醬汁）。
7. 你必須【絕對嚴格】只回傳合法 JSON Array，不要 Markdown，不要其他文字。

格式範例：
[{"name":"白飯","calories":260,"protein":5,"carbs":58,"fats":1,"base_weight_g":200,"portion_hint":"一碗"},{"name":"去皮雞胸","calories":165,"protein":31,"carbs":0,"fats":4,"base_weight_g":120,"portion_hint":"一塊"}]`;

export type DetectedMealFood = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  baseWeightG?: number;
  portionHint?: string;
};

export class MealPhotoDetectError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "MealPhotoDetectError";
    this.status = status;
  }
}

function readMacro(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
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

function getVisionModelCandidates(): string[] {
  const preferred = [
    process.env.OPENROUTER_VISION_MODEL?.trim(),
    getOpenRouterVisionModel(),
    ...OPENROUTER_VISION_FALLBACKS,
  ].filter((m): m is string => Boolean(m));
  return Array.from(new Set(preferred));
}

function parseDetectedFoodsJson(text: string): DetectedMealFood[] {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];

  const raw = JSON.parse(match[0]) as unknown;
  if (!Array.isArray(raw)) return [];

  const foods: DetectedMealFood[] = [];

  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const name = String(item.name ?? item.food_name ?? "").trim();
    const calories = readMacro(item.calories);
    if (!name || calories <= 0) continue;

    const baseWeightG = readMacro(item.base_weight_g ?? item.baseWeightG);
    const portionHint = String(item.portion_hint ?? item.portionHint ?? "").trim();

    foods.push({
      name,
      calories,
      protein: readMacro(item.protein ?? item.protein_g),
      carbs: readMacro(item.carbs ?? item.carbs_g),
      fats: readMacro(item.fats ?? item.fat ?? item.fat_g),
      baseWeightG: baseWeightG > 0 ? baseWeightG : undefined,
      portionHint: portionHint || undefined,
    });

    if (foods.length >= 8) break;
  }

  return foods;
}

async function requestOpenRouterVisionDetect(
  model: string,
  dataUrl: string,
  apiKey: string,
  lang: AppLanguage
): Promise<DetectedMealFood[]> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `請辨識這張食物相片入面有幾樣食物，分開列出每樣的營養估算。${getLanguageInstruction(lang)}`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.warn(
      `[meal-photo-detect] openrouter ${model} error`,
      res.status,
      detail.slice(0, 300)
    );
    throw new MealPhotoDetectError(`OpenRouter ${model} 失敗 (${res.status})`, 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new MealPhotoDetectError(`OpenRouter: ${data.error.message}`, 502);
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  const foods = parseDetectedFoodsJson(content);
  if (foods.length === 0) {
    throw new MealPhotoDetectError("AI 未能辨識食物，請手動輸入描述", 502);
  }

  return foods;
}

async function requestOpenAiVisionDetect(
  dataUrl: string,
  lang: AppLanguage
): Promise<DetectedMealFood[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new MealPhotoDetectError("OPENAI_API_KEY 未設定", 503);
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
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `請辨識這張食物相片入面有幾樣食物，分開列出每樣的營養估算。${getLanguageInstruction(lang)}`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new MealPhotoDetectError(`OpenAI Vision 失敗 (${res.status})`, 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const foods = parseDetectedFoodsJson(content);
  if (foods.length === 0) {
    throw new MealPhotoDetectError("AI 未能辨識食物，請手動輸入描述", 502);
  }

  return foods;
}

export function isMealPhotoDetectConfigured(): boolean {
  return (
    isOpenRouterConfigured() || Boolean(process.env.OPENAI_API_KEY?.trim())
  );
}

export async function detectFoodsFromMealPhoto(
  imageBase64: string,
  lang: AppLanguage = "zh-HK"
): Promise<{ foods: DetectedMealFood[]; source: "openrouter" | "openai" }> {
  const dataUrl = normalizeImageBase64(imageBase64);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (apiKey) {
    const models = getVisionModelCandidates();
    let lastError: unknown;
    for (const model of models) {
      try {
        const foods = await requestOpenRouterVisionDetect(
          model,
          dataUrl,
          apiKey,
          lang
        );
        return { foods, source: "openrouter" };
      } catch (err) {
        lastError = err;
        console.warn("[meal-photo-detect] model failed", model, err);
      }
    }

    if (process.env.OPENAI_API_KEY?.trim()) {
      try {
        const foods = await requestOpenAiVisionDetect(dataUrl, lang);
        return { foods, source: "openai" };
      } catch (openAiErr) {
        console.warn("[meal-photo-detect] openai fallback failed", openAiErr);
      }
    }

    throw lastError instanceof MealPhotoDetectError
      ? lastError
      : new MealPhotoDetectError("AI 食物辨識暫時不可用", 502);
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    const foods = await requestOpenAiVisionDetect(dataUrl, lang);
    return { foods, source: "openai" };
  }

  throw new MealPhotoDetectError(
    "AI 食物辨識尚未設定，請設定 OPENROUTER_API_KEY 或 OPENAI_API_KEY",
    503
  );
}
