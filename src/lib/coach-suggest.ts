import {
  getOpenRouterModel,
  isOpenRouterConfigured,
} from "@/lib/food-search/openrouter";
import { getLanguageInstruction, type AppLanguage } from "@/lib/i18n";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type MacroSnapshot = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type RestOfDayMeal = {
  slot: string;
  title: string;
  description: string;
  estimated_calories?: number;
  protein_g?: number;
};

export type CoachSuggestInput = {
  targets: MacroSnapshot;
  consumed: MacroSnapshot;
  craving?: string;
  lang?: AppLanguage;
  mealsLoggedToday?: number;
  /** When true, ask the model for different alternatives (not a repeat of avoidTitles). */
  regenerate?: boolean;
  avoidTitles?: string[];
};

export type CoachSuggestResult = {
  suggestion_text: string;
  tags: string[];
  rest_of_day_meals: RestOfDayMeal[];
  remaining: MacroSnapshot;
  mode: "craving_plus_plan" | "full_day_plan";
};

const SYSTEM_PROMPT = `你係 Nutrition Coach 嘅大猩猩健身教練——嚴格但實用、香港地道、幽默直接。

學員會提供：剩餘營養額度 (P/C/F/kcal)、今日已食、已打卡餐數、願望關鍵字（可能留空）、仲有邊幾個時段可以食。

【兩種模式】
A) 有願望關鍵字：先就佢想食嘅嘢畀 1 個具體「下一餐」建議（較健康點法），然後假設食完之後，規劃今日剩餘時段仲可以食咩（rest_of_day_meals）。
B) 願望留空：唔使講單一 cravings，直接畀今日剩餘時段嘅「全日飲食餐單／外食建議」（rest_of_day_meals 要覆蓋所有剩餘時段）；suggestion_text 用 1–2 句總結今日策略。

規則：
1. 額度極少 → 低卡高蛋白；邪惡 cravings → 健康點法替代，唔好一味禁止。
2. rest_of_day_meals 每項要具體到可以落單（茶餐廳/便利店/外賣店名或菜式），2–4 項，按時段 slot（例如下午茶、晚餐、宵夜）。
3. 每項估算 estimated_calories、protein_g（整數），總和唔好明顯超過剩餘額度。
4. suggestion_text：生動在地 1–3 段，可加「— 大猩猩教練」。
5. tags：2–4 個短標籤。

只回傳合法 JSON，不要 Markdown：
{"suggestion_text":"...","tags":["..."],"rest_of_day_meals":[{"slot":"晚餐","title":"...","description":"...","estimated_calories":400,"protein_g":35}]}`;

function clampRemaining(target: number, consumed: number): number {
  return Math.max(0, Math.round(target - consumed));
}

export function computeRemainingMacros(
  targets: MacroSnapshot,
  consumed: MacroSnapshot
): MacroSnapshot {
  return {
    calories: clampRemaining(targets.calories, consumed.calories),
    protein: clampRemaining(targets.protein, consumed.protein),
    carbs: clampRemaining(targets.carbs, consumed.carbs),
    fats: clampRemaining(targets.fats, consumed.fats),
  };
}

function getRemainingMealSlots(lang: AppLanguage): string[] {
  const h = new Date().getHours();
  const slots =
    lang === "en"
      ? {
          breakfast: "Breakfast",
          lunch: "Lunch",
          afternoon: "Afternoon snack",
          dinner: "Dinner",
          late: "Late snack",
        }
      : lang === "zh-TW"
        ? {
            breakfast: "早餐",
            lunch: "午餐",
            afternoon: "下午茶",
            dinner: "晚餐",
            late: "宵夜",
          }
        : {
            breakfast: "早餐",
            lunch: "午餐",
            afternoon: "下午茶",
            dinner: "晚餐",
            late: "宵夜",
          };

  if (h < 10) {
    return [slots.breakfast, slots.lunch, slots.afternoon, slots.dinner];
  }
  if (h < 14) return [slots.lunch, slots.afternoon, slots.dinner];
  if (h < 17) return [slots.afternoon, slots.dinner];
  if (h < 21) return [slots.dinner, slots.late];
  return [slots.late];
}

function parseRestOfDayMeals(raw: unknown): RestOfDayMeal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const slot = String(row.slot ?? "").trim();
      const title = String(row.title ?? "").trim();
      const description = String(row.description ?? "").trim();
      if (!slot || !title) return null;
      const cal = Number(row.estimated_calories);
      const pro = Number(row.protein_g);
      return {
        slot,
        title,
        description,
        ...(Number.isFinite(cal) && cal > 0
          ? { estimated_calories: Math.round(cal) }
          : {}),
        ...(Number.isFinite(pro) && pro > 0
          ? { protein_g: Math.round(pro) }
          : {}),
      } satisfies RestOfDayMeal;
    })
    .filter((m): m is RestOfDayMeal => m !== null)
    .slice(0, 5);
}

function parseCoachSuggestJson(
  raw: string,
  mode: CoachSuggestResult["mode"]
): Omit<CoachSuggestResult, "remaining"> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
      suggestion_text?: unknown;
      tags?: unknown;
      rest_of_day_meals?: unknown;
    };
    const text = String(parsed.suggestion_text ?? "").trim();
    if (!text) return null;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
      : [];
    const rest_of_day_meals = parseRestOfDayMeals(parsed.rest_of_day_meals);
    return { suggestion_text: text, tags, rest_of_day_meals, mode };
  } catch {
    return null;
  }
}

function buildFallbackRestOfDay(
  remaining: MacroSnapshot,
  craving: string,
  lang: AppLanguage,
  hasCraving: boolean
): RestOfDayMeal[] {
  const slots = getRemainingMealSlots(lang);
  const dinnerSlot = slots.find((s) => s.includes("晚") || s.includes("Dinner")) ?? slots[slots.length - 1];
  const afternoonSlot = slots.find((s) => s.includes("下午") || s.includes("Afternoon"));

  if (remaining.calories <= 0) return [];

  const dinnerCal = Math.min(
    Math.round(remaining.calories * (hasCraving ? 0.55 : 0.45)),
    remaining.calories
  );
  const dinnerPro = Math.min(
    Math.round(remaining.protein * (hasCraving ? 0.6 : 0.5)),
    remaining.protein
  );

  const meals: RestOfDayMeal[] = [];

  if (!hasCraving && slots.length >= 2) {
    const lunchSlot = slots[0];
    const lunchCal = Math.round(remaining.calories * 0.35);
    meals.push({
      slot: lunchSlot,
      title:
        lang === "en"
          ? "Cha chaan teng set"
          : "茶餐廳套餐",
      description:
        lang === "en"
          ? "Steamed chicken breast + veg, rice half portion, unsweetened tea"
          : "蒸雞胸 + 菜心（走汁）+ 少飯，飲無糖茶",
      estimated_calories: lunchCal,
      protein_g: Math.round(remaining.protein * 0.35),
    });
  }

  meals.push({
    slot: dinnerSlot,
    title:
      lang === "en" ? "Chicken salad box" : "雞胸沙律飯盒",
    description:
      lang === "en"
        ? "Convenience store or delivery — dressing on the side"
        : hasCraving
          ? `食完${craving.slice(0, 20)}之後，晚餐改清淡：便利店雞胸沙律（走醬）或外賣蒸魚配菜`
          : "便利店或外賣：雞胸沙律走醬，或茶餐廳蒸水蛋 + 時蔬",
    estimated_calories: dinnerCal,
    protein_g: dinnerPro,
  });

  if (afternoonSlot && remaining.calories > 500 && !hasCraving) {
    meals.splice(1, 0, {
      slot: afternoonSlot,
      title: lang === "en" ? "Greek yogurt + fruit" : "希臘乳酪 + 水果",
      description:
        lang === "en"
          ? "No added sugar, ~150 kcal protein boost"
          : "無糖希臘乳酪加少量水果，補蛋白又唔會爆卡",
      estimated_calories: 150,
      protein_g: 12,
    });
  }

  return meals.slice(0, 4);
}

function buildFallbackSuggestion(
  remaining: MacroSnapshot,
  craving: string,
  lang: AppLanguage,
  mealsLoggedToday: number
): CoachSuggestResult {
  const c = craving.trim();
  const hasCraving = Boolean(c);
  const mode: CoachSuggestResult["mode"] = hasCraving
    ? "craving_plus_plan"
    : "full_day_plan";
  const lowQuota = remaining.calories < 300 || remaining.protein < 15;
  const tags: string[] = [];

  if (lowQuota) {
    tags.push(lang === "en" ? "Low cal" : "低卡", lang === "en" ? "High protein" : "高蛋白");
  }

  let suggestion_text: string;

  if (remaining.calories <= 0) {
    suggestion_text =
      lang === "en"
        ? "You've hit today's calorie target — stick to water or unsweetened tea for the rest of the day. — Coach Gorilla"
        : lang === "zh-TW"
          ? "今日熱量額度已用完，今晚改喝無糖茶或清水，明天再衝！— 大猩猩教練"
          : "今日卡路里 quota 用晒啦，今晚改飲無糖茶或清水，聽日再搏！— 大猩猩教練";
    tags.push(lang === "en" ? "Rest day" : "收工");
  } else if (hasCraving) {
    suggestion_text = lowQuota
      ? `你想食「${c}」？額度唔多，揀細份 + 走醬走芝士，配無糖飲。食完跟下面餐單收尾。— 大猩猩教練`
      : `「${c}」可以食！記住：走醬、薯條改沙律或同朋友分，唔好連甜品一齊清。食完跟下面剩餘餐單，今日仲可以食得聰明。— 大猩猩教練`;
    tags.push(c.slice(0, 14), lang === "en" ? "Smart order" : "聰明點法");
  } else if (lowQuota) {
    suggestion_text =
      lang === "en"
        ? `Only ${remaining.calories} kcal left — follow the meal plan below, prioritise protein. — Coach Gorilla`
        : `仲得 ${remaining.calories} kcal，跟下面全日餐單走，優先補蛋白質！— 大猩猩教練`;
    tags.push(lang === "en" ? "Meal plan" : "全日餐單");
  } else {
    suggestion_text =
      lang === "en"
        ? `You've logged ${mealsLoggedToday} meals — ${remaining.calories} kcal left today. Here's your rest-of-day eating plan below. — Coach Gorilla`
        : `今日已記 ${mealsLoggedToday} 餐，仲有 ${remaining.calories} kcal 額度。跟下面全日外食餐單，唔使諗到頭都爆！— 大猩猩教練`;
    tags.push(lang === "en" ? "Full day plan" : "全日建議", lang === "en" ? "Eating out" : "外食實戰");
  }

  const rest_of_day_meals = buildFallbackRestOfDay(
    remaining,
    c,
    lang,
    hasCraving
  );

  return {
    suggestion_text,
    tags: tags.slice(0, 4),
    rest_of_day_meals,
    remaining,
    mode,
  };
}

export async function generateCoachMealSuggestion(
  input: CoachSuggestInput
): Promise<CoachSuggestResult> {
  const lang = input.lang ?? "zh-HK";
  const craving = (input.craving ?? "").trim().slice(0, 80);
  const hasCraving = Boolean(craving);
  const mode: CoachSuggestResult["mode"] = hasCraving
    ? "craving_plus_plan"
    : "full_day_plan";
  const remaining = computeRemainingMacros(input.targets, input.consumed);
  const mealsLoggedToday = Math.max(0, input.mealsLoggedToday ?? 0);
  const remainingSlots = getRemainingMealSlots(lang);

  if (!isOpenRouterConfigured()) {
    return buildFallbackSuggestion(remaining, craving, lang, mealsLoggedToday);
  }

  const apiKey = process.env.OPENROUTER_API_KEY!.trim();
  const model = getOpenRouterModel();
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk";

  const avoidTitles = (input.avoidTitles ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
  const regenerateNote =
    input.regenerate && avoidTitles.length > 0
      ? `\n【重要】用戶想睇「其他選擇」——請提供完全不同、有創意嘅新建議（換餐廳類型、菜式、點法）。絕對唔好重複以下菜式：${avoidTitles.join("、")}`
      : input.regenerate
        ? "\n【重要】用戶想睇「其他選擇」——請提供完全不同、有創意嘅新建議，唔好同上次一樣。"
        : "";

  const userMessage = `模式：${hasCraving ? "A（有願望，先答 cravings 再規劃剩餘餐）" : "B（無願望，直接全日剩餘餐單）"}
剩餘額度：${remaining.calories} kcal，蛋白 ${remaining.protein}g，碳水 ${remaining.carbs}g，脂肪 ${remaining.fats}g。
今日已食：${input.consumed.calories} kcal / 目標 ${input.targets.calories} kcal；已打卡 ${mealsLoggedToday} 餐。
今日仲可以規劃嘅時段：${remainingSlots.join("、")}
願望關鍵字：${craving || "（留空）"}${regenerateNote}
${getLanguageInstruction(lang)}`;

  try {
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
        temperature: input.regenerate ? 0.95 : 0.75,
        max_tokens: 1000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      console.warn("[coach-suggest] OpenRouter error", res.status);
      return buildFallbackSuggestion(remaining, craving, lang, mealsLoggedToday);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (data.error?.message) {
      console.warn("[coach-suggest]", data.error.message);
      return buildFallbackSuggestion(remaining, craving, lang, mealsLoggedToday);
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseCoachSuggestJson(content, mode);
    if (parsed) {
      const rest =
        parsed.rest_of_day_meals.length > 0
          ? parsed.rest_of_day_meals
          : buildFallbackRestOfDay(remaining, craving, lang, hasCraving);
      return { ...parsed, rest_of_day_meals: rest, remaining };
    }
  } catch (err) {
    console.warn("[coach-suggest] failed:", err);
  }

  return buildFallbackSuggestion(remaining, craving, lang, mealsLoggedToday);
}
