import { estimateFoodSearchMacros } from "@/lib/ai-mock";
import { getLanguageInstruction, type AppLanguage } from "@/lib/i18n";
import { estimateMealNutritionWithAi } from "@/lib/meal-ai-verify";
import {
  getOpenRouterVisionModelCandidates,
  normalizeImageBase64,
} from "@/lib/ocr-nutrition";
import { isOpenRouterConfigured } from "@/lib/food-search/openrouter";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

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

function extractDetectedRows(text: string): Record<string, unknown>[] {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  const tryParse = (snippet: string): Record<string, unknown>[] | null => {
    try {
      const parsed = JSON.parse(snippet) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (row): row is Record<string, unknown> =>
            Boolean(row) && typeof row === "object" && !Array.isArray(row)
        );
      }
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        for (const key of ["foods", "items", "food_items", "results", "dishes"]) {
          const nested = obj[key];
          if (Array.isArray(nested)) {
            return nested.filter(
              (row): row is Record<string, unknown> =>
                Boolean(row) && typeof row === "object" && !Array.isArray(row)
            );
          }
        }
        if (obj.name || obj.food_name || obj.title) {
          return [obj];
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const rows = tryParse(arrayMatch[0]);
    if (rows?.length) return rows;
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const rows = tryParse(objectMatch[0]);
    if (rows?.length) return rows;
  }

  return [];
}

function rowToDetectedFood(item: Record<string, unknown>): DetectedMealFood | null {
  const name = String(item.name ?? item.food_name ?? item.title ?? "").trim();
  if (!name) return null;

  let protein = readMacro(item.protein ?? item.protein_g);
  let carbs = readMacro(item.carbs ?? item.carbs_g);
  let fats = readMacro(item.fats ?? item.fat ?? item.fat_g);
  let calories = readMacro(item.calories ?? item.kcal);

  if (calories <= 0) {
    calories = Math.round(protein * 4 + carbs * 4 + fats * 9);
  }

  if (calories <= 0) {
    const est = estimateFoodSearchMacros(name);
    calories = est.calories;
    if (protein <= 0) protein = est.protein;
    if (carbs <= 0) carbs = est.carbs;
    if (fats <= 0) fats = est.fats;
  }

  if (calories <= 0) return null;

  const baseWeightG = readMacro(item.base_weight_g ?? item.baseWeightG ?? item.weight_g);
  const portionHint = String(item.portion_hint ?? item.portionHint ?? "").trim();

  return {
    name,
    calories,
    protein,
    carbs,
    fats,
    baseWeightG: baseWeightG > 0 ? baseWeightG : undefined,
    portionHint: portionHint || undefined,
  };
}

function parseDetectedFoodsJson(text: string): DetectedMealFood[] {
  const rows = extractDetectedRows(text);
  const foods: DetectedMealFood[] = [];

  for (const row of rows) {
    const food = rowToDetectedFood(row);
    if (!food) continue;
    foods.push(food);
    if (foods.length >= 8) break;
  }

  return foods;
}

async function fallbackFoodsFromMealVision(
  imageBase64: string
): Promise<DetectedMealFood[]> {
  const result = await estimateMealNutritionWithAi({
    description: "相片內的食物（請依可見菜式估算整餐營養）",
    imageBase64,
    baselineSource: "rules",
  });

  const name = result.description.trim() || "相片食物";
  return [
    {
      name,
      calories: result.macros.calories,
      protein: result.macros.protein,
      carbs: result.macros.carbs,
      fats: result.macros.fats,
      portionHint: "一份",
    },
  ];
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
      max_tokens: 2000,
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
      max_tokens: 2000,
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
): Promise<{ foods: DetectedMealFood[]; source: "openrouter" | "openai" | "vision_estimate" }> {
  const dataUrl = normalizeImageBase64(imageBase64);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  let lastError: unknown;

  if (apiKey) {
    const models = getOpenRouterVisionModelCandidates();
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
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401")) throw err;
        console.warn("[meal-photo-detect] model failed", model, err);
      }
    }
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      const foods = await requestOpenAiVisionDetect(dataUrl, lang);
      return { foods, source: "openai" };
    } catch (openAiErr) {
      lastError = openAiErr;
      console.warn("[meal-photo-detect] openai fallback failed", openAiErr);
    }
  }

  if (isMealPhotoDetectConfigured()) {
    try {
      const foods = await fallbackFoodsFromMealVision(imageBase64);
      if (foods.length > 0) {
        return { foods, source: "vision_estimate" };
      }
    } catch (visionEstErr) {
      lastError = visionEstErr;
      console.warn("[meal-photo-detect] vision estimate fallback failed", visionEstErr);
    }
  }

  if (!isMealPhotoDetectConfigured()) {
    throw new MealPhotoDetectError(
      "AI 食物辨識尚未設定，請設定 OPENROUTER_API_KEY 或 OPENAI_API_KEY",
      503
    );
  }

  throw lastError instanceof MealPhotoDetectError
    ? lastError
    : new MealPhotoDetectError("AI 食物辨識暫時不可用，請稍後再試", 502);
}
