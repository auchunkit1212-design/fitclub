import { computeTargetProfile } from "@/lib/body-profile";
import { AI_GORILLA_COACH_EMAIL } from "@/lib/registry-constants";
import type { MealLog, StudentBodyProfile, StudentNutritionTargets } from "@/lib/types";

export type FitnessGoal = "cut" | "bulk" | "maintain";

export function isAiSoloTenantSlug(slug?: string | null): boolean {
  return slug === "ai-gorilla-coach";
}

function macroSplit(calories: number, goal: FitnessGoal) {
  let proteinRatio = 0.3;
  let fatRatio = 0.28;
  if (goal === "cut") {
    proteinRatio = 0.35;
    fatRatio = 0.25;
  } else if (goal === "bulk") {
    proteinRatio = 0.28;
    fatRatio = 0.3;
  }
  const protein = Math.round((calories * proteinRatio) / 4);
  const fats = Math.round((calories * fatRatio) / 9);
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);
  return {
    targetProtein: protein,
    targetCarbs: Math.max(50, carbs),
    targetFats: Math.max(35, fats),
  };
}

export async function generateAiNutritionTargets(
  profile: StudentBodyProfile,
  goal: FitnessGoal,
  tenantId?: string
): Promise<StudentNutritionTargets> {
  const base = computeTargetProfile(profile);
  let targetCalories = base.targetCalories;
  if (goal === "cut") targetCalories = Math.max(1200, targetCalories - 150);
  if (goal === "bulk") targetCalories = targetCalories + 250;

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
          temperature: 0.4,
          max_tokens: 200,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "你是香港健身營養教練。根據學員身體數據同目標，輸出 JSON：{targetCalories,targetProtein,targetCarbs,targetFats} 整數。",
            },
            {
              role: "user",
              content: `身高${profile.heightCm}cm 體重${profile.weightKg}kg 年齡${profile.age} 目標體重${profile.targetWeightKg}kg 目標：${
                goal === "cut" ? "減脂" : goal === "bulk" ? "增肌" : "維持"
              }。請給每日卡路里與三大营养素目標。`,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const parsed = JSON.parse(
          data.choices?.[0]?.message?.content ?? "{}"
        ) as Partial<StudentNutritionTargets>;
        if (parsed.targetCalories && parsed.targetProtein) {
          return {
            studentEmail: profile.email,
            targetCalories: Math.round(parsed.targetCalories),
            targetProtein: Math.round(parsed.targetProtein),
            targetCarbs: Math.round(parsed.targetCarbs ?? macroSplit(targetCalories, goal).targetCarbs),
            targetFats: Math.round(parsed.targetFats ?? macroSplit(targetCalories, goal).targetFats),
            locked: true,
            setByCoachEmail: AI_GORILLA_COACH_EMAIL,
            tenantId,
          };
        }
      }
    } catch (err) {
      console.warn("[ai-solo-coach] OpenAI targets failed", err);
    }
  }

  const macros = macroSplit(targetCalories, goal);
  return {
    studentEmail: profile.email,
    targetCalories,
    targetProtein: Math.max(base.targetProtein, macros.targetProtein),
    targetCarbs: macros.targetCarbs,
    targetFats: macros.targetFats,
    locked: true,
    setByCoachEmail: AI_GORILLA_COACH_EMAIL,
    tenantId,
  };
}

export async function generateGorillaMealReview(
  log: MealLog,
  targets?: StudentNutritionTargets | null
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallback =
    log.calories > 750
      ? "油太多啦，今晚罰你做掌上壓！🦍"
      : log.protein >= 25
        ? "嘩！這餐蛋白質很足，繼續保持！🦍"
        : "記得下一餐加啲蛋白質，大猩猩盯緊你！🦍";

  if (!apiKey) return fallback;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
        temperature: 0.85,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              "你是 Nutrition Coach 的大猩猩 AI 私教，用繁體中文、幽默直接、1-2 句，必須以 🦍 結尾。",
          },
          {
            role: "user",
            content: `學員剛記錄：${log.mealType} ${log.description}，${log.calories}kcal，蛋白${log.protein}g。每日目標約${targets?.targetCalories ?? 2000}kcal。請點評。`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return fallback;
    return text.endsWith("🦍") ? text : `${text} 🦍`;
  } catch {
    return fallback;
  }
}
