import { AI_CALORIE_SYSTEM_PROMPT, estimateMacros, PORTION_NONE } from "@/lib/ai-mock";
import { parseAdvancedFromAiRow } from "@/lib/food-advanced-nutrients";
import { isOpenRouterConfigured } from "@/lib/food-search/openrouter";
import type { MacroEstimate } from "@/lib/macro-scale";
import {
  buildPortionGuidanceBlock,
  constrainMacrosToPortionHints,
  parsePortionHintsFromDescription,
  type ParsedPortionHints,
  type PortionSize,
} from "@/lib/portion-hints";
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

export class MealAiEstimateError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "MealAiEstimateError";
    this.status = status;
  }
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
  const portionHints = parsePortionHintsFromDescription(description);
  const portionBlock = buildPortionGuidanceBlock(portionHints);
  const baseline = input.baseline;
  const sourceLabel = baselineSourceLabel(input.baselineSource);

  let baselineBlock =
    "目前尚無參考數值，請【完全依描述同相片】用 AI 專業估算，不可憑空假設未提及的食物";
  if (baseline && baseline.calories > 0) {
    baselineBlock = `${sourceLabel}參考：${baseline.calories} kcal，蛋白 ${baseline.protein}g，碳水 ${baseline.carbs}g，脂肪 ${baseline.fats}g（僅作輔助，你必須獨立判斷是否正確）`;
    if (input.baselineSource === "local_db") {
      baselineBlock +=
        "（本地資料庫可能與實際品牌、份量或烹調方式不符，請務必核实）";
    }
  }
  baselineBlock += input.imageBase64
    ? "；請結合相片確認食物種類、每樣份量、是否與描述一致"
    : "；描述括號內的拳頭／手掌份量為學員實際進食量，優先於菜式名稱的默認整碗份量";

  const advanced = input.advanced;
  const advancedBlock =
    advanced &&
    (advanced.sodiumMg || advanced.sugarG || advanced.fiberG || advanced.saturatedFatG)
      ? `\n參考微量營養：鈉 ${advanced.sodiumMg ?? 0} mg，糖 ${advanced.sugarG ?? 0} g，纖維 ${advanced.fiberG ?? 0} g，飽和脂肪 ${advanced.saturatedFatG ?? 0} g。`
      : "";

  return `學員飲食描述：「${description}」
${baselineBlock}${portionBlock}${advancedBlock}

請輸出整餐最合理的總營養（整數）。若參考值與描述/相片明顯不符，必須修正。
${portionBlock ? "有學員份量標記時：蛋白質只計對應手掌大小的肉量，碳水只計對應拳頭大小的澱粉，不可按整碗拉麵／整碟餸默認值。" : ""}
只回傳 JSON：
{"food_name":"食物名稱","calories":數字,"protein":數字,"carbs":數字,"fat":數字,"fiber_g":數字,"sugar_g":數字,"saturated_fat_g":數字,"sodium_mg":數字,"cholesterol_mg":數字,"note":"一句話說明修正原因（可選）"}`;
}

function macrosAdjusted(before: MacroEstimate | undefined, after: MacroEstimate): boolean {
  if (!before || before.calories <= 0) return true;
  const calDiff = Math.abs(before.calories - after.calories);
  return calDiff >= Math.max(20, before.calories * 0.08);
}

const TEXT_MODEL_FALLBACKS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "openai/gpt-4o-mini",
  "google/gemini-flash-1.5-8b",
] as const;

function getTextModelCandidates(): string[] {
  const preferred = [
    process.env.OPENROUTER_MODEL?.trim(),
    ...TEXT_MODEL_FALLBACKS,
  ].filter((m): m is string => Boolean(m));
  return Array.from(new Set(preferred));
}

function getVisionModelCandidates(): string[] {
  const preferred = [
    process.env.OPENROUTER_VISION_MODEL?.trim(),
    process.env.OPENROUTER_MODEL?.trim(),
    getOpenRouterVisionModel(),
    ...TEXT_MODEL_FALLBACKS,
  ].filter((m): m is string => Boolean(m));
  return Array.from(new Set(preferred));
}

function portionSizeToCarbsLegacy(size: PortionSize | null): string {
  if (!size || size === "none") return PORTION_NONE;
  if (size === "small") return "細拳";
  if (size === "large") return "大拳";
  return "中拳";
}

function portionSizeToProteinLegacy(size: PortionSize | null): string {
  if (!size || size === "none") return PORTION_NONE;
  if (size === "small") return "細掌";
  if (size === "large") return "大掌";
  return "中掌";
}

function veggiesLegacy(hints: ParsedPortionHints): string {
  if (hints.hasVeggies === true) return "有";
  if (hints.hasVeggies === false) return PORTION_NONE;
  return PORTION_NONE;
}

function localRulesEstimate(input: MealVerifyInput): MealVerifyResult {
  const description = input.description.trim();
  const hints = parsePortionHintsFromDescription(description);
  const descForRules = hints.foodBase || description;
  let macros = estimateMacros(
    descForRules,
    portionSizeToCarbsLegacy(hints.carbsPortion),
    portionSizeToProteinLegacy(hints.proteinPortion),
    veggiesLegacy(hints)
  );
  const portionConstrained = constrainMacrosToPortionHints(macros, hints);
  macros = portionConstrained.macros;

  return {
    macros,
    advanced: input.advanced,
    description,
    source: "baseline",
    note: "AI 暫時不可用，已使用本地規則估算",
    adjusted: true,
  };
}

async function requestOpenRouterVerify(
  input: MealVerifyInput,
  useVision: boolean,
  model: string
): Promise<MealVerifyResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const prompt = buildVerifyPrompt(input);

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
    const detail = await res.text();
    throw new Error(`OpenRouter ${model} ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseVerifyJson(content, input.description.trim());

  let macros: MacroEstimate = {
    calories: parsed.calories,
    protein: parsed.protein,
    carbs: parsed.carbs,
    fats: parsed.fat,
  };

  const portionHints = parsePortionHintsFromDescription(input.description);
  const portionConstrained = constrainMacrosToPortionHints(macros, portionHints);
  macros = portionConstrained.macros;

  const notes = [parsed.note, portionConstrained.note].filter(Boolean);
  const combinedNote = notes.length > 0 ? notes.join("；") : undefined;

  return {
    macros,
    advanced: parsed.advanced,
    description: mergeVerifiedDescription(input.description, parsed.food_name),
    source: useVision ? "openrouter_vision" : "openrouter",
    note: combinedNote,
    adjusted:
      macrosAdjusted(input.baseline, macros) || portionConstrained.adjusted,
  };
}

async function requestOpenRouterVerifyWithFallbacks(
  input: MealVerifyInput,
  useVision: boolean
): Promise<MealVerifyResult> {
  const models = useVision ? getVisionModelCandidates() : getTextModelCandidates();
  let lastErr: unknown;

  for (const model of models) {
    try {
      return await requestOpenRouterVerify(input, useVision, model);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.includes("403")) throw err;
      console.warn(`[meal-ai-verify] ${model} skipped:`, err);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("OpenRouter failed");
}

/** AI 優先估算：結合描述、參考數值，有相片時用 Vision 一併分析 */
export async function estimateMealNutritionWithAi(
  input: MealVerifyInput
): Promise<MealVerifyResult> {
  const description = input.description.trim();
  if (!description) {
    throw new MealAiEstimateError("請填寫食物描述", 400);
  }

  const image = input.imageBase64?.trim();
  const useVision = Boolean(image);

  if (isOpenRouterConfigured()) {
    try {
      return await requestOpenRouterVerifyWithFallbacks(input, useVision);
    } catch (visionErr) {
      if (useVision) {
        console.warn("[meal-ai-verify] vision failed, retry text-only:", visionErr);
        try {
          return await requestOpenRouterVerifyWithFallbacks(
            { ...input, imageBase64: undefined },
            false
          );
        } catch (textErr) {
          console.warn("[meal-ai-verify] text-only failed:", textErr);
        }
      } else {
        console.warn("[meal-ai-verify] estimate failed:", visionErr);
      }
    }
  } else {
    console.warn("[meal-ai-verify] OPENROUTER_API_KEY not set, using local rules");
  }

  const baseline = input.baseline;
  if (baseline && baseline.calories > 0 && input.baselineSource !== "rules") {
    return {
      macros: baseline,
      advanced: input.advanced,
      description,
      source: "baseline",
      note: "AI 暫時不可用，已使用表單參考數值",
      adjusted: false,
    };
  }

  return localRulesEstimate(input);
}

/** 儲存前 AI 覆核（一律先走 AI 估算） */
export async function verifyMealNutrition(
  input: MealVerifyInput
): Promise<MealVerifyResult> {
  return estimateMealNutritionWithAi(input);
}
