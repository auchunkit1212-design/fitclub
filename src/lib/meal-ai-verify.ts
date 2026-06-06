import { AI_CALORIE_SYSTEM_PROMPT } from "@/lib/ai-mock";
import { parseAdvancedFromAiRow } from "@/lib/food-advanced-nutrients";
import { isOpenRouterConfigured } from "@/lib/food-search/openrouter";
import {
  estimateMilkMacros,
  isMilkLikeDescription,
  parseVolumeMl,
  type MacroEstimate,
} from "@/lib/macro-scale";
import {
  getOpenRouterVisionModel,
  normalizeImageBase64,
} from "@/lib/ocr-nutrition";
import type { FoodAdvancedNutrients } from "@/lib/types";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type MealBaselineSource =
  | "local_db"
  | "openrouter"
  | "ocr"
  | "rules"
  | "manual";

export type MealVerifyInput = {
  description: string;
  baseline?: MacroEstimate;
  advanced?: FoodAdvancedNutrients;
  imageBase64?: string;
  baselineSource?: MealBaselineSource;
};

export type MealVerifyResult = {
  macros: MacroEstimate;
  advanced?: FoodAdvancedNutrients;
  description: string;
  source: "openrouter" | "openrouter_vision" | "baseline";
  note?: string;
  adjusted: boolean;
};

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

function readMacro(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function parseVerifyJson(text: string, fallbackName: string): {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note?: string;
  advanced?: FoodAdvancedNutrients;
} {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 未回傳 JSON");
  const raw = JSON.parse(match[0]) as Record<string, unknown>;
  const calories = readMacro(raw.calories);
  if (calories <= 0) throw new Error("AI 回傳熱量無效");

  const food_name =
    String(raw.food_name ?? raw.product_name ?? raw.name ?? fallbackName).trim() ||
    fallbackName;

  return {
    food_name,
    calories,
    protein: readMacro(raw.protein ?? raw.protein_g),
    carbs: readMacro(raw.carbs ?? raw.carbs_g),
    fat: readMacro(raw.fat ?? raw.fats ?? raw.fats_g),
    note: typeof raw.note === "string" ? raw.note.trim() : undefined,
    advanced: parseAdvancedFromAiRow(raw),
  };
}

function mergeVerifiedDescription(original: string, aiName: string): string {
  const trimmed = original.trim();
  const portionMatch = trimmed.match(/^(.+?)（(.+)）$/);
  const name = aiName.trim();
  if (!name) return trimmed;
  if (portionMatch) {
    return `${name}（${portionMatch[2]}）`;
  }
  return name;
}

function baselineSourceLabel(source?: MealBaselineSource): string {
  switch (source) {
    case "local_db":
      return "本地資料庫";
    case "openrouter":
      return "AI 聯想";
    case "ocr":
      return "標籤 OCR";
    case "rules":
      return "本地規則估算";
    default:
      return "表單數值";
  }
}

function buildVerifyPrompt(input: MealVerifyInput): string {
  const description = input.description.trim();
  const baseline = input.baseline;
  const sourceLabel = baselineSourceLabel(input.baselineSource);

  let baselineBlock = "目前尚無參考數值，請依描述";
  if (baseline && baseline.calories > 0) {
    baselineBlock = `${sourceLabel}參考：${baseline.calories} kcal，蛋白 ${baseline.protein}g，碳水 ${baseline.carbs}g，脂肪 ${baseline.fats}g`;
    if (input.baselineSource === "local_db") {
      baselineBlock +=
        "（本地資料庫可能與實際品牌、份量或烹調方式不符，請務必核实）";
    }
  }
  baselineBlock += input.imageBase64
    ? "；請結合相片確認食物種類、份量、是否與描述一致"
    : "；請依常見一人份或描述中的份量估算";

  const advanced = input.advanced;
  const advancedBlock =
    advanced &&
    (advanced.sodiumMg || advanced.sugarG || advanced.fiberG || advanced.saturatedFatG)
      ? `\n參考微量營養：鈉 ${advanced.sodiumMg ?? 0} mg，糖 ${advanced.sugarG ?? 0} g，纖維 ${advanced.fiberG ?? 0} g，飽和脂肪 ${advanced.saturatedFatG ?? 0} g。`
      : "";

  return `學員飲食描述：「${description}」
${baselineBlock}${advancedBlock}

請輸出整餐最合理的總營養（整數）。若參考值與描述/相片明顯不符，必須修正。
只回傳 JSON：
{"food_name":"食物名稱","calories":數字,"protein":數字,"carbs":數字,"fat":數字,"fiber_g":數字,"sugar_g":數字,"saturated_fat_g":數字,"sodium_mg":數字,"cholesterol_mg":數字,"note":"一句話說明修正原因（可選）"}`;
}

function macrosAdjusted(before: MacroEstimate | undefined, after: MacroEstimate): boolean {
  if (!before || before.calories <= 0) return true;
  const calDiff = Math.abs(before.calories - after.calories);
  return calDiff >= Math.max(20, before.calories * 0.08);
}

function shouldSkipVerify(description: string): MacroEstimate | null {
  const volumeMl = parseVolumeMl(description);
  if (isMilkLikeDescription(description) && volumeMl !== null) {
    return estimateMilkMacros(volumeMl);
  }
  return null;
}

async function requestOpenRouterVerify(
  input: MealVerifyInput,
  useVision: boolean
): Promise<MealVerifyResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const prompt = buildVerifyPrompt(input);
  const model = useVision
    ? getOpenRouterVisionModel()
    : process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";

  const userContent: unknown = useVision
    ? [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: normalizeImageBase64(input.imageBase64!) },
        },
      ]
    : prompt;

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: "system", content: AI_CALORIE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseVerifyJson(content, input.description.trim());

  const macros: MacroEstimate = {
    calories: parsed.calories,
    protein: parsed.protein,
    carbs: parsed.carbs,
    fats: parsed.fat,
  };

  return {
    macros,
    advanced: parsed.advanced,
    description: mergeVerifiedDescription(input.description, parsed.food_name),
    source: useVision ? "openrouter_vision" : "openrouter",
    note: parsed.note,
    adjusted: macrosAdjusted(input.baseline, macros),
  };
}

/** 儲存前 AI 覆核：結合描述、參考數值，有相片時用 Vision 一併分析 */
export async function verifyMealNutrition(
  input: MealVerifyInput
): Promise<MealVerifyResult> {
  const description = input.description.trim();
  if (!description) {
    throw new Error("請填寫食物描述");
  }

  const milkMacros = shouldSkipVerify(description);
  if (milkMacros) {
    return {
      macros: milkMacros,
      description,
      source: "baseline",
      adjusted: false,
    };
  }

  const baseline: MacroEstimate = input.baseline ?? {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  };

  if (!isOpenRouterConfigured()) {
    return {
      macros: baseline,
      advanced: input.advanced,
      description,
      source: "baseline",
      adjusted: false,
    };
  }

  const image = input.imageBase64?.trim();
  const useVision = Boolean(image);

  try {
    return await requestOpenRouterVerify(input, useVision);
  } catch (visionErr) {
    if (useVision) {
      console.warn("[meal-ai-verify] vision failed, retry text-only:", visionErr);
      try {
        return await requestOpenRouterVerify(
          { ...input, imageBase64: undefined },
          false
        );
      } catch (textErr) {
        console.warn("[meal-ai-verify] text-only failed:", textErr);
      }
    } else {
      console.warn("[meal-ai-verify] verify failed:", visionErr);
    }
  }

  return {
    macros: baseline,
    advanced: input.advanced,
    description,
    source: "baseline",
    adjusted: false,
  };
}
