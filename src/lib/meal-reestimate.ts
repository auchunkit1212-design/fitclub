import { PORTION_NONE, estimateMacrosWithBreakdown } from "@/lib/ai-mock";
import { isOpenRouterConfigured } from "@/lib/food-search/openrouter";
import { parseAiJson } from "@/lib/food-search/shared";
import type { MacroEstimate } from "@/lib/macro-scale";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type MealReestimateResult = {
  macros: MacroEstimate;
  source: "rules" | "openrouter";
  parts?: { name: string; macros: MacroEstimate }[];
};

/** 依食物描述重算營養；可選教練手動值作為 AI 校正參考 */
export async function reestimateMealFromDescription(input: {
  description: string;
  coachHint?: MacroEstimate;
}): Promise<MealReestimateResult> {
  const description = input.description.trim();
  if (!description) {
    throw new Error("請填寫食物描述");
  }

  if (input.coachHint && isOpenRouterConfigured()) {
    try {
      const ai = await reestimateWithOpenRouter(description, input.coachHint);
      return { macros: ai, source: "openrouter" };
    } catch (err) {
      console.warn("[meal-reestimate] OpenRouter fallback to rules:", err);
    }
  }

  const result = estimateMacrosWithBreakdown(
    description,
    PORTION_NONE,
    PORTION_NONE,
    PORTION_NONE
  );

  return {
    macros: result.macros,
    source: "rules",
    parts: result.isComposite ? result.parts : undefined,
  };
}

async function reestimateWithOpenRouter(
  description: string,
  coachHint: MacroEstimate
): Promise<MacroEstimate> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const model = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk";

  const prompt = `你是嚴謹的營養師。學員記錄了以下飲食（可能包含多樣，用 + 或逗號分隔）：
「${description}」

教練認為較合理的總營養約為：${coachHint.calories} kcal，蛋白 ${coachHint.protein}g，碳水 ${coachHint.carbs}g，脂肪 ${coachHint.fats}g。

請綜合描述與教練意見，輸出修正後的「整餐」總營養（整數）。只回傳 JSON：
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
            "只回傳合法 JSON，不要 markdown。多樣食物要加總。",
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
