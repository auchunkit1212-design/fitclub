import {
  generateCoachReport,
  generateRoast,
  getMealAiComment,
} from "@/lib/ai-mock";
import {
  getOpenRouterModel,
  isOpenRouterConfigured,
} from "@/lib/food-search/openrouter";
import { getLanguageInstruction, type AppLanguage } from "@/lib/i18n";
import type { MealLog } from "@/lib/types";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type MealFeedbackInput = Pick<
  MealLog,
  "mealType" | "description" | "calories" | "protein" | "carbs" | "fats"
>;

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs?: number;
  fats?: number;
};

const ROAST_SYSTEM_PROMPT = `你是 Nutrition Coach 大猩猩健身教練——嚴格、幽默、香港地道。

學員會提供【今日實際飲食記錄】（每餐描述、餐別、營養數字）及【目標宏量】。

你的吐槽／點評必須遵守：
1. 【只根據提供的實際餐食發言】——嚴禁虛構學員未食過的食物（例如記錄中無乾炒牛河就不可提乾炒牛河、茶餐廳）。
2. 可點名記錄中的具體餐食（用 description）及其熱量／蛋白質，評論要與數據吻合。
3. 語氣幽默直接，1–3 句，唔好過長，唔好用 Markdown。
4. 若今日未打卡，鼓勵佢記錄第一餐。
5. 若整體達標，具體讚賞今日食得最好的一餐。`;

const COACH_REPORT_SYSTEM_PROMPT = `你是健身教練後台的 AI 分析助手，為教練整理學員飲食打卡。

根據【實際飲食記錄】生成整合報告，必須：
1. 只引用記錄中真實出現的餐食（description），禁止虛構未出現的食物。
2. 結構清晰，包含：數據概覽、高風險飲食、表現良好、教練建議。
3. 高風險：點名熱量偏高（>700 kcal）的具體餐食；表現良好：點名蛋白質充足或熱量適中的餐食。
4. 用繁體中文，專業實用，唔好用 Markdown 標題符號。`;

const MEAL_COMMENT_SYSTEM_PROMPT = `你是香港健身營養教練。根據【單一餐食記錄】給一句具體點評（1–2 句）。
必須點名該餐的 description，評論要與其卡路里／蛋白質數字吻合，禁止虛構其他食物。`;

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

function formatMealsForPrompt(meals: MealFeedbackInput[]): string {
  if (meals.length === 0) return "（今日尚未打卡）";
  return meals
    .map(
      (m, i) =>
        `${i + 1}. [${m.mealType}] ${m.description} — ${m.calories} kcal，蛋白 ${m.protein}g，碳水 ${m.carbs}g，脂肪 ${m.fats}g`
    )
    .join("\n");
}

function summarizeMacros(meals: MealFeedbackInput[]): {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
} {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fats: acc.fats + m.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

async function callOpenRouterText(
  system: string,
  user: string,
  maxTokens = 500
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const model = getOpenRouterModel();
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.55,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.warn("[ai-feedback] openrouter error", res.status, detail.slice(0, 300));
    return null;
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : null;
}

export async function generateAiRoast(input: {
  meals: MealFeedbackInput[];
  targets: MacroTargets;
  lang?: AppLanguage;
  studentName?: string;
}): Promise<{ text: string; source: "openrouter" | "fallback" }> {
  const lang = input.lang ?? "zh-HK";
  const totals = summarizeMacros(input.meals);

  if (!isOpenRouterConfigured()) {
    return {
      text: generateRoast(
        totals.calories,
        input.targets.calories,
        totals.protein,
        input.targets.protein,
        lang,
        input.meals
      ),
      source: "fallback",
    };
  }

  const userPrompt = `學員：${input.studentName?.trim() || "學員"}
目標：${input.targets.calories} kcal / ${input.targets.protein}g 蛋白質
今日已食：${totals.calories} kcal / ${totals.protein}g 蛋白質

今日實際餐食記錄：
${formatMealsForPrompt(input.meals)}

${getLanguageInstruction(lang)}
請根據以上【實際記錄】寫 1–3 句教練吐槽／點評。`;

  const aiText = await callOpenRouterText(ROAST_SYSTEM_PROMPT, userPrompt, 280);
  if (aiText) {
    return { text: aiText, source: "openrouter" };
  }

  return {
    text: generateRoast(
      totals.calories,
      input.targets.calories,
      totals.protein,
      input.targets.protein,
      lang,
      input.meals
    ),
    source: "fallback",
  };
}

export async function generateAiCoachReport(input: {
  logs: MealLog[];
  lang?: AppLanguage;
  gymName?: string;
  studentName?: string;
}): Promise<{ text: string; source: "openrouter" | "fallback" }> {
  const lang = input.lang ?? "zh-HK";
  const studentLabel = input.studentName?.trim();

  if (input.logs.length === 0) {
    return {
      text: generateCoachReport(input.logs, studentLabel),
      source: "fallback",
    };
  }

  if (!isOpenRouterConfigured()) {
    return {
      text: generateCoachReport(input.logs, studentLabel),
      source: "fallback",
    };
  }

  const scopeLine = studentLabel
    ? `整合範圍：單一學員「${studentLabel}」`
    : "整合範圍：全部旗下學員";

  const userPrompt = `分店：${input.gymName?.trim() || "未指定"}
${scopeLine}
打卡總數：${input.logs.length} 餐

學員實際飲食記錄：
${formatMealsForPrompt(input.logs)}

${getLanguageInstruction(lang)}
請生成教練整合報告。`;

  const aiText = await callOpenRouterText(
    COACH_REPORT_SYSTEM_PROMPT,
    userPrompt,
    900
  );
  if (aiText) {
    return { text: aiText, source: "openrouter" };
  }

  return {
    text: generateCoachReport(input.logs, studentLabel),
    source: "fallback",
  };
}

export async function generateAiMealComment(
  log: MealLog,
  lang: AppLanguage = "zh-HK"
): Promise<{ text: string; source: "openrouter" | "fallback" }> {
  if (!isOpenRouterConfigured()) {
    return { text: getMealAiComment(log), source: "fallback" };
  }

  const userPrompt = `餐別：${log.mealType}
食物：${log.description}
熱量：${log.calories} kcal | 蛋白質：${log.protein}g | 碳水：${log.carbs}g | 脂肪：${log.fats}g

${getLanguageInstruction(lang)}
請給一句具體點評。`;

  const aiText = await callOpenRouterText(
    MEAL_COMMENT_SYSTEM_PROMPT,
    userPrompt,
    160
  );
  if (aiText) {
    return { text: aiText, source: "openrouter" };
  }

  return { text: getMealAiComment(log), source: "fallback" };
}
