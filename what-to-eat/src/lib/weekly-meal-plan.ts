import { getLanguageInstruction, type AppLanguage } from "@/lib/i18n";
import { isOpenRouterConfigured, openRouterChatJson } from "@/lib/openrouter";
import type {
  MacroTargets,
  WeeklyMealPlanPayload,
  WeeklyMealSlot,
  WeeklyPlanDay,
  WteDietProfile,
} from "@/lib/types";

export type WeeklyPlanInput = {
  targets: MacroTargets;
  diet: WteDietProfile;
  lang?: AppLanguage;
  weekStart: string;
  regenerate?: boolean;
  /** Avoid repeating these titles when regenerating */
  avoidTitles?: string[];
  /** Regenerate only one day (YYYY-MM-DD) and/or one slot label */
  focusDate?: string;
  focusSlot?: string;
  /** Existing plan to patch when regenerating a subset */
  existing?: WeeklyMealPlanPayload | null;
};

const SYSTEM_PROMPT = `你係 Nutrition Coach「食咩好」嘅大猩猩健身教練——嚴格但實用、香港地道、幽默直接。

任務：根據用戶身體目標、飲食偏好、敏感、場景，生成【一星期】餐單。
每一餐必須同時提供：
1) eat_out：外食／茶餐廳／便利店／外賣點法（具體到可落單）
2) cook：自己煮（簡短 ingredients 陣列 + steps 陣列，2–5 步）

規則：
1. 嚴格避開 allergens、disliked_ingredients；遵守 diet_styles（keto／low_carb／vegetarian／vegan／halal）。
2. medical_flags 只作溫和飲食約束（例如糖尿病偏少糖、高血壓偏少鹽），唔好診斷或聲稱療效。
3. 每日各 slot 嘅 estimated_calories + protein_g 加總應接近每日 targets（可 ±15%）。
4. 菜系跟 cuisine_prefs；場景跟 cooking_scenes（有 home 就 cook 要可落地；有 takeout／convenience 就 eat_out 要現實）。
5. meal_schedule：threeMeals=早午晚；fourMeals=加下午茶；fasting168=跳早餐，午／下／晚。
6. summary_text：1–3 句策略總結，可加「— 大猩猩教練」。
7. tags：2–4 個短標籤。
8. 只回傳合法 JSON，不要 Markdown。

格式：
{"summary_text":"...","tags":["..."],"days":[{"date":"YYYY-MM-DD","day_label":"星期一","slots":[{"slot":"早餐","eat_out":{"title":"...","description":"..."},"cook":{"title":"...","description":"...","ingredients":["..."],"steps":["..."]},"estimated_calories":400,"protein_g":30}]}]}`;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(isoDate: string, lang: AppLanguage): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const weekday = d.getUTCDay();
  if (lang === "en") {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday];
  }
  return ["日", "一", "二", "三", "四", "五", "六"].map(
    (x, i) => (lang === "zh-TW" ? `週${x}` : `星期${x}`)
  )[weekday];
}

function slotsForSchedule(
  schedule: WteDietProfile["mealSchedule"],
  lang: AppLanguage
): string[] {
  if (lang === "en") {
    if (schedule === "fasting168") return ["Lunch", "Afternoon snack", "Dinner"];
    if (schedule === "fourMeals")
      return ["Breakfast", "Lunch", "Afternoon snack", "Dinner"];
    return ["Breakfast", "Lunch", "Dinner"];
  }
  if (schedule === "fasting168") return ["午餐", "下午茶", "晚餐"];
  if (schedule === "fourMeals") return ["早餐", "午餐", "下午茶", "晚餐"];
  return ["早餐", "午餐", "晚餐"];
}

function splitDailyMacros(
  targets: MacroTargets,
  slotCount: number
): Array<{ calories: number; protein: number }> {
  const weights =
    slotCount === 4
      ? [0.25, 0.3, 0.15, 0.3]
      : slotCount === 3
        ? [0.3, 0.35, 0.35]
        : Array.from({ length: slotCount }, () => 1 / slotCount);
  return weights.map((w) => ({
    calories: Math.round(targets.calories * w),
    protein: Math.round(targets.protein * w),
  }));
}

function buildFallbackSlot(
  slot: string,
  cal: number,
  pro: number,
  diet: WteDietProfile,
  lang: AppLanguage,
  dayIndex: number
): WeeklyMealSlot {
  const lowCarb =
    diet.dietStyles.includes("keto") || diet.dietStyles.includes("low_carb");
  const veg =
    diet.dietStyles.includes("vegetarian") || diet.dietStyles.includes("vegan");
  const proteinTitle = veg
    ? lang === "en"
      ? "Tofu + egg (skip if vegan)"
      : "豆腐／蛋菜式"
    : lang === "en"
      ? "Chicken breast box"
      : "雞胸肉飯盒";

  const carbNote = lowCarb
    ? lang === "en"
      ? "swap rice for extra veg / cauliflower rice"
      : "走飯或改花椰菜飯，加菜"
    : lang === "en"
      ? "half rice OK"
      : "少飯 OK";

  const variants = [
    lang === "en" ? "steamed" : "蒸",
    lang === "en" ? "grilled" : "焗",
    lang === "en" ? "soup-based" : "湯底",
  ];
  const v = variants[dayIndex % variants.length];

  return {
    slot,
    eat_out: {
      title: `${proteinTitle}（${v}）`,
      description:
        lang === "en"
          ? `Order ${proteinTitle.toLowerCase()}, ${carbNote}, no sugary drink.`
          : `茶餐廳／便利店：${proteinTitle}，${carbNote}，飲無糖茶。`,
    },
    cook: {
      title:
        lang === "en"
          ? `Home ${v} protein bowl`
          : `自家${v}蛋白碗`,
      description:
        lang === "en"
          ? "15–25 min. High protein, matches your targets."
          : "約 15–25 分鐘。高蛋白，貼近你今日額度。",
      ingredients: veg
        ? lang === "en"
          ? ["Firm tofu 200g", "Mixed veg", "Olive oil", "Salt/pepper"]
          : ["板豆腐 200g", "時蔬", "少許油", "鹽／胡椒"]
        : lang === "en"
          ? ["Chicken breast 150g", "Broccoli", "Egg 1", "Seasoning"]
          : ["雞胸 150g", "西蘭花", "蛋 1 隻", "調味"],
      steps: [
        lang === "en" ? "Prep protein and veg." : "切好蛋白同菜。",
        lang === "en" ? "Cook until done; season lightly." : "煮熟，少鹽調味。",
        lang === "en" ? "Plate and eat." : "盛碟即食。",
      ],
    },
    estimated_calories: cal,
    protein_g: pro,
  };
}

export function buildFallbackWeeklyPlan(
  input: WeeklyPlanInput
): WeeklyMealPlanPayload {
  const lang = input.lang ?? "zh-HK";
  const slots = slotsForSchedule(input.diet.mealSchedule, lang);
  const parts = splitDailyMacros(input.targets, slots.length);
  const days: WeeklyPlanDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(input.weekStart, i);
    days.push({
      date,
      day_label: dayLabel(date, lang),
      slots: slots.map((slot, si) =>
        buildFallbackSlot(
          slot,
          parts[si].calories,
          parts[si].protein,
          input.diet,
          lang,
          i + si
        )
      ),
    });
  }

  return {
    summary_text:
      lang === "en"
        ? `Here's your 7-day plan for ~${input.targets.calories} kcal / ${input.targets.protein}g protein. Mix eat-out and home cooking. — Coach Gorilla`
        : `呢個係你一星期餐單，每日約 ${input.targets.calories} kcal、蛋白 ${input.targets.protein}g。外食同煮食都有，跟住嚟就得。— 大猩猩教練`,
    tags:
      lang === "en"
        ? ["7-day", "Eat out + cook", "Protein first"]
        : ["一週餐單", "外食+煮食", "高蛋白"],
    days,
    targets: input.targets,
  };
}

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizePayload(
  parsed: unknown,
  input: WeeklyPlanInput,
  lang: AppLanguage
): WeeklyMealPlanPayload | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const daysRaw = obj.days;
  if (!Array.isArray(daysRaw) || daysRaw.length < 1) return null;

  const days: WeeklyPlanDay[] = [];
  for (let i = 0; i < Math.min(7, daysRaw.length); i++) {
    const d = daysRaw[i] as Record<string, unknown>;
    const date =
      typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date)
        ? d.date
        : addDays(input.weekStart, i);
    const slotsRaw = Array.isArray(d.slots) ? d.slots : [];
    const slots: WeeklyMealSlot[] = slotsRaw.map((s) => {
      const slot = s as Record<string, unknown>;
      const eat = (slot.eat_out ?? {}) as Record<string, unknown>;
      const cook = (slot.cook ?? {}) as Record<string, unknown>;
      return {
        slot: String(slot.slot ?? "Meal"),
        eat_out: {
          title: String(eat.title ?? "Eat out"),
          description: String(eat.description ?? ""),
        },
        cook: {
          title: String(cook.title ?? "Cook"),
          description: String(cook.description ?? ""),
          ingredients: Array.isArray(cook.ingredients)
            ? cook.ingredients.map(String)
            : undefined,
          steps: Array.isArray(cook.steps)
            ? cook.steps.map(String)
            : undefined,
        },
        estimated_calories: Math.round(Number(slot.estimated_calories) || 0),
        protein_g: Math.round(Number(slot.protein_g) || 0),
      };
    });
    if (slots.length === 0) continue;
    days.push({
      date,
      day_label:
        typeof d.day_label === "string" ? d.day_label : dayLabel(date, lang),
      slots,
    });
  }

  if (days.length === 0) return null;

  // Pad to 7 days with fallback if model returned partial week
  while (days.length < 7) {
    const i = days.length;
    const date = addDays(input.weekStart, i);
    const slotNames = slotsForSchedule(input.diet.mealSchedule, lang);
    const parts = splitDailyMacros(input.targets, slotNames.length);
    days.push({
      date,
      day_label: dayLabel(date, lang),
      slots: slotNames.map((slot, si) =>
        buildFallbackSlot(
          slot,
          parts[si].calories,
          parts[si].protein,
          input.diet,
          lang,
          i + si
        )
      ),
    });
  }

  const tags = Array.isArray(obj.tags)
    ? obj.tags.map(String).slice(0, 4)
    : [];

  return {
    summary_text: String(obj.summary_text ?? "").trim() ||
      (lang === "en" ? "Weekly plan ready. — Coach Gorilla" : "一週餐單搞掂。— 大猩猩教練"),
    tags,
    days: days.slice(0, 7),
    targets: input.targets,
  };
}

export async function generateWeeklyMealPlan(
  input: WeeklyPlanInput
): Promise<WeeklyMealPlanPayload> {
  const lang = input.lang ?? "zh-HK";
  const fallback = buildFallbackWeeklyPlan(input);

  if (!isOpenRouterConfigured()) return fallback;

  const slotNames = slotsForSchedule(input.diet.mealSchedule, lang);
  const focusHint =
    input.focusDate || input.focusSlot
      ? `只重新生成 date=${input.focusDate ?? "any"} slot=${input.focusSlot ?? "all slots that day"}；其他日子保持合理一週結構仍要完整 7 日輸出。`
      : "生成完整 7 日。";

  const userPrompt = [
    getLanguageInstruction(lang),
    `week_start=${input.weekStart}`,
    `targets=${JSON.stringify(input.targets)}`,
    `goal_type=${input.diet.goalType}`,
    `meal_schedule=${input.diet.mealSchedule} slots=${slotNames.join(",")}`,
    `diet_styles=${JSON.stringify(input.diet.dietStyles)}`,
    `allergens=${JSON.stringify(input.diet.allergens)}`,
    `disliked=${JSON.stringify(input.diet.dislikedIngredients)}`,
    `cuisines=${JSON.stringify(input.diet.cuisinePrefs)}`,
    `scenes=${JSON.stringify(input.diet.cookingScenes)}`,
    `protein_priority=${input.diet.proteinPriority}`,
    `protein_sources=${JSON.stringify(input.diet.proteinSources)}`,
    `medical_flags=${JSON.stringify(input.diet.medicalFlags)}`,
    input.regenerate ? "regenerate=true 請畀唔同選擇" : "regenerate=false",
    input.avoidTitles?.length
      ? `avoid_titles=${JSON.stringify(input.avoidTitles.slice(0, 40))}`
      : "",
    focusHint,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const content = await openRouterChatJson({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: input.regenerate ? 0.9 : 0.7,
    });
    if (!content) return fallback;
    const parsed = extractJsonObject(content);
    const normalized = normalizePayload(parsed, input, lang);
    if (!normalized) return fallback;

    // If focusing on one day, merge into existing plan
    if (input.existing && input.focusDate) {
      const mergedDays = input.existing.days.map((d) => {
        if (d.date !== input.focusDate) return d;
        const fresh = normalized.days.find((x) => x.date === input.focusDate);
        if (!fresh) return d;
        if (!input.focusSlot) return fresh;
        return {
          ...d,
          slots: d.slots.map((s) => {
            if (s.slot !== input.focusSlot) return s;
            return (
              fresh.slots.find((fs) => fs.slot === input.focusSlot) ?? s
            );
          }),
        };
      });
      return {
        ...normalized,
        days: mergedDays,
        summary_text: normalized.summary_text,
        targets: input.targets,
      };
    }

    return normalized;
  } catch (err) {
    console.warn("[weekly-meal-plan] AI failed, using fallback", err);
    return fallback;
  }
}
