import { computeTargetProfile, isValidWeightChangePace } from "@/lib/body-profile";
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

function paceToFitnessGoal(profile: StudentBodyProfile): FitnessGoal {
  const pace = profile.weightChangeKgPerWeek;
  if (!isValidWeightChangePace(pace)) return "maintain";
  if (pace < 0) return "cut";
  if (pace > 0) return "bulk";
  return "maintain";
}

function paceLabel(profile: StudentBodyProfile): string {
  const pace = profile.weightChangeKgPerWeek;
  if (pace === 1) return "每週增重 1kg";
  if (pace === 0.5) return "每週增重 0.5kg";
  if (pace === -0.5) return "每週減重 0.5kg";
  if (pace === -1) return "每週減重 1kg";
  return "維持體重";
}

export async function generateAiNutritionTargets(
  profile: StudentBodyProfile,
  goal?: FitnessGoal,
  tenantId?: string
): Promise<StudentNutritionTargets> {
  const effectiveGoal = goal ?? paceToFitnessGoal(profile);
  const base = computeTargetProfile(profile);
  const targetCalories = base.targetCalories;

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
              content: `身高${profile.heightCm}cm 體重${profile.weightKg}kg 年齡${profile.age} 目標體重${profile.targetWeightKg}kg 每週目標：${paceLabel(profile)}。請給每日卡路里與三大营养素目標。`,
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
            targetCarbs: Math.round(parsed.targetCarbs ?? macroSplit(targetCalories, effectiveGoal).targetCarbs),
            targetFats: Math.round(parsed.targetFats ?? macroSplit(targetCalories, effectiveGoal).targetFats),
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

  const macros = macroSplit(targetCalories, effectiveGoal);
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
      ? "油太多啦，今晚罰你做掌上壓！— 大猩猩教練"
      : log.protein >= 25
        ? "嘩！這餐蛋白質很足，繼續保持！— 大猩猩教練"
        : "記得下一餐加啲蛋白質，大猩猩盯緊你！— 大猩猩教練";

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
              "你是 Nutrition Coach 的大猩猩 AI 私教，用繁體中文、幽默直接、1-2 句，句末可加「— 大猩猩教練」。",
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
    return text;
  } catch {
    return fallback;
  }
}
