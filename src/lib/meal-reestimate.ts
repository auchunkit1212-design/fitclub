import { PORTION_NONE, estimateMacrosWithBreakdown } from "@/lib/ai-mock";
import { isOpenRouterConfigured } from "@/lib/food-search/openrouter";
import { parseAiJson } from "@/lib/food-search/shared";
import {
  estimateMilkMacros,
  isMilkLikeDescription,
  parseVolumeMl,
  type MacroEstimate,
} from "@/lib/macro-scale";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type MealReestimateResult = {
  macros: MacroEstimate;
  source: "rules" | "openrouter";
  parts?: { name: string; macros: MacroEstimate }[];
};

function isCoachManualOverride(
  hint: MacroEstimate,
  rules: MacroEstimate
): boolean {
  const calDiff = Math.abs(hint.calories - rules.calories);
  return calDiff >= Math.max(25, rules.calories * 0.12);
}

function deterministicRulesResult(
  description: string
): MealReestimateResult | null {
  const volumeMl = parseVolumeMl(description);
  if (isMilkLikeDescription(description) && volumeMl !== null) {
    const macros = estimateMilkMacros(volumeMl);
    return { macros, source: "rules" };
  }
  return null;
}

/** 依食物描述重算營養；coachHint 僅在與本地估算明顯不同時視為教練手動修正 */
export async function reestimateMealFromDescription(input: {
  description: string;
  coachHint?: MacroEstimate;
}): Promise<MealReestimateResult> {
  const description = input.description.trim();
  if (!description) {
    throw new Error("請填寫食物描述");
  }

  const deterministic = deterministicRulesResult(description);
  if (deterministic) {
    return deterministic;
  }

  const rulesResult = estimateMacrosWithBreakdown(
    description,
    PORTION_NONE,
    PORTION_NONE,
    PORTION_NONE
  );

  if (rulesResult.isComposite && rulesResult.parts.length > 1) {
    return {
      macros: rulesResult.macros,
      source: "rules",
      parts: rulesResult.parts,
    };
  }

  const rulesMacros = rulesResult.macros;
  const manualHint =
    input.coachHint && isCoachManualOverride(input.coachHint, rulesMacros)
      ? input.coachHint
      : undefined;

  if (isOpenRouterConfigured()) {
    try {
      const ai = await reestimateWithOpenRouter(
        description,
        rulesMacros,
        manualHint
      );
      return { macros: ai, source: "openrouter" };
    } catch (err) {
      console.warn("[meal-reestimate] OpenRouter fallback to rules:", err);
    }
  }

  return {
    macros: rulesMacros,
    source: "rules",
    parts: rulesResult.isComposite ? rulesResult.parts : undefined,
  };
}

async function reestimateWithOpenRouter(
  description: string,
  rulesBaseline: MacroEstimate,
  coachOverride?: MacroEstimate
): Promise<MacroEstimate> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const model = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk";

  const coachBlock = coachOverride
    ? `\n教練已手動修正為參考：${coachOverride.calories} kcal，蛋白 ${coachOverride.protein}g，碳水 ${coachOverride.carbs}g，脂肪 ${coachOverride.fats}g（若與容量／品項不符，以食物描述與常見營養數據為準）。`
    : "";

  const prompt = `你是嚴謹的香港營養師。學員飲食描述（可能多樣，用 +、逗號分隔）：
「${description}」

本地規則估算約：${rulesBaseline.calories} kcal，蛋白 ${rulesBaseline.protein}g，碳水 ${rulesBaseline.carbs}g，脂肪 ${rulesBaseline.fats}g。
注意：200ml 全脂鮮奶約 120–135 kcal，勿與整包／公仔麵混淆；多樣要加總。${coachBlock}

請依描述輸出「整餐」總營養（整數）。只回傳 JSON：
{"calories":數字,"protein":數字,"carbs":數字,"fat":數字}`;

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
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "只回傳合法 JSON，不要 markdown。以描述與常見一人份為準，勿沿用明顯錯誤的舊熱量。",
        },
        { role: "user", content: prompt },
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
  const parsed = parseAiJson(content, description);

  return {
    calories: parsed.calories,
    protein: parsed.protein,
    carbs: parsed.carbs,
    fats: parsed.fat,
  };
}
