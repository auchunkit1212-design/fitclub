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

export type CoachSuggestInput = {
  targets: MacroSnapshot;
  consumed: MacroSnapshot;
  craving?: string;
  lang?: AppLanguage;
};

export type CoachSuggestResult = {
  suggestion_text: string;
  tags: string[];
  remaining: MacroSnapshot;
};

const SYSTEM_PROMPT = `你係 Nutrition Coach 嘅大猩猩健身教練——嚴格但實用、香港地道、幽默直接。
根據學員「剩餘營養額度」(蛋白 P、碳水 C、脂肪 F、卡路里) 同佢嘅「願望關鍵字」(可能係茶餐廳、壽司、快餐等，或者留空)，推薦 1 至 2 個具體「下一餐」建議。

規則：
1. 額度極少（例如剩餘 <300 kcal 或蛋白 <15g）→ 優先低卡高蛋白（蒸雞胸、無糖豆漯、沙律等）。
2. 願望食物太「邪惡」→ 唔好一味禁止，要畀「較健康點法」（例如茶餐廳：走汁、少飯、加菜；壽司：避開炸物、選刺身）。
3. 建議要具體到可以即刻落單，唔好空泛。
4. 語氣生動、在地化，1–3 段短文字，可加「— 大猩猩教練」結尾。
5. tags 係 2–4 個短標籤（例如「高蛋白」「茶餐廳」「低卡」）。

你必須【絕對嚴格】只回傳一個合法 JSON 物件，不要用 Markdown 標記，不要包含其他文字：
{"suggestion_text":"...","tags":["標籤1","標籤2"]}`;

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

function parseCoachSuggestJson(raw: string): CoachSuggestResult | null {
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
    };
    const text = String(parsed.suggestion_text ?? "").trim();
    if (!text) return null;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
      : [];
    return { suggestion_text: text, tags, remaining: { calories: 0, protein: 0, carbs: 0, fats: 0 } };
  } catch {
    return null;
  }
}

function buildFallbackSuggestion(
  remaining: MacroSnapshot,
  craving: string,
  lang: AppLanguage
): CoachSuggestResult {
  const c = craving.trim();
  const lowQuota = remaining.calories < 300 || remaining.protein < 15;
  const tags: string[] = [];

  if (lowQuota) tags.push(lang === "en" ? "Low cal" : "低卡", lang === "en" ? "High protein" : "高蛋白");

  let suggestion_text: string;

  if (remaining.calories <= 0) {
    suggestion_text =
      lang === "en"
        ? "You've hit today's calorie target — stick to water or unsweetened tea for the rest of the day. — Coach Gorilla"
        : lang === "zh-TW"
          ? "今日熱量額度已用完，今晚改喝無糖茶或清水，明天再衝！— 大猩猩教練"
          : "今日卡路里 quota 用晒啦，今晚改飲無糖茶或清水，聽日再搏！— 大猩猩教練";
    tags.push(lang === "en" ? "Rest day" : "收工");
  } else if (c.includes("茶餐廳") || c.toLowerCase().includes("cha chaan")) {
    suggestion_text = lowQuota
      ? "茶餐廳低卡點法：要「蒸水蛋 + 去皮雞胸 + 走汁菜心」，飲無糖凍檸茶。大約 350 kcal、蛋白 30g+，唔使餓住收工。— 大猩猩教練"
      : `茶餐廳可以咁點：${remaining.calories >= 500 ? "乾炒牛河改「少油 + 加菜」" : "火腿通粉改「走油 + 加蛋」"}，再加一杯無糖豆漿補蛋白。邪惡 cravings 要識揀，唔係完全唔食！— 大猩猩教練`;
    tags.push("茶餐廳", lowQuota ? "低卡" : "實戰點法");
  } else if (c.includes("壽司") || c.toLowerCase().includes("sushi")) {
    suggestion_text = lowQuota
      ? "壽司低卡策略：刺身拼盤 + 1 件玉子燒，避開炸物同醬油多嘅卷物。蛋白夠、油少。— 大猩猩教練"
      : `壽司可以：${remaining.protein >= 25 ? "刺身 + 1 碗醋飯（細份）" : "先食刺身拼盤，卷物最多 2 件"}，唔好連續食炸蝦卷。— 大猩猩教練`;
    tags.push("壽司", "聰明點法");
  } else if (c) {
    suggestion_text = lowQuota
      ? `你想食「${c}」？額度唔多，建議揀小份 + 加蛋白（例如雞胸/豆腐），甜品改無糖飲。— 大猩猩教練`
      : `「${c}」可以食，但跟住嚟：主菜揀蒸/烤、醬汁另上、澱粉減半。你仲有 ${remaining.calories} kcal 額度，唔好一次過清晒！— 大猩猩教練`;
    tags.push(c.slice(0, 12), lowQuota ? "低卡" : "下一餐");
  } else if (lowQuota) {
    suggestion_text =
      lang === "en"
        ? `Only ${remaining.calories} kcal left — grab a chicken breast salad box or steamed egg + greens. Keep protein high, fats low. — Coach Gorilla`
        : `仲得 ${remaining.calories} kcal，下一餐鎖定：雞胸沙律飯盒（走醬）或蒸水蛋 + 時蔬。蛋白要補返！— 大猩猩教練`;
    tags.push("高蛋白", "便利店/外賣");
  } else {
    suggestion_text =
      lang === "en"
        ? `You've got ${remaining.calories} kcal, ${remaining.protein}g protein left. Try: cha chaan teng steamed chicken + veg (light sauce), or a convenience-store salad + soy milk. — Coach Gorilla`
        : `仲有 ${remaining.calories} kcal、蛋白 ${remaining.protein}g 額度。建議：茶餐廳蒸雞胸配菜心（少油），或者便利店雞胸沙律 + 無糖豆漿。— 大猩猩教練`;
    tags.push("下一餐", "香港實戰");
  }

  return { suggestion_text, tags: tags.slice(0, 4), remaining };
}

export async function generateCoachMealSuggestion(
  input: CoachSuggestInput
): Promise<CoachSuggestResult> {
  const lang = input.lang ?? "zh-HK";
  const craving = (input.craving ?? "").trim().slice(0, 80);
  const remaining = computeRemainingMacros(input.targets, input.consumed);

  if (!isOpenRouterConfigured()) {
    return buildFallbackSuggestion(remaining, craving, lang);
  }

  const apiKey = process.env.OPENROUTER_API_KEY!.trim();
  const model = getOpenRouterModel();
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk";

  const userMessage = `剩餘額度：${remaining.calories} kcal，蛋白 ${remaining.protein}g，碳水 ${remaining.carbs}g，脂肪 ${remaining.fats}g。
今日已食：${input.consumed.calories} kcal / 目標 ${input.targets.calories} kcal。
願望關鍵字：${craving || "（留空，由教練決定）"}
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
        temperature: 0.75,
        max_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      console.warn("[coach-suggest] OpenRouter error", res.status);
      return { ...buildFallbackSuggestion(remaining, craving, lang), remaining };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (data.error?.message) {
      console.warn("[coach-suggest]", data.error.message);
      return { ...buildFallbackSuggestion(remaining, craving, lang), remaining };
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseCoachSuggestJson(content);
    if (parsed) {
      return { ...parsed, remaining };
    }
  } catch (err) {
    console.warn("[coach-suggest] failed:", err);
  }

  return { ...buildFallbackSuggestion(remaining, craving, lang), remaining };
}
