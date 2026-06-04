import { generateRoast } from "@/lib/ai-mock";
import type { MealLog } from "@/lib/types";

export interface MealRecommendation {
  title: string;
  description: string;
  estimatedCalories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export function buildNightlyAiCoachReview(
  logs: MealLog[],
  targetCalories: number,
  targetProtein: number
): string {
  const cal = logs.reduce((s, l) => s + l.calories, 0);
  const pro = logs.reduce((s, l) => s + l.protein, 0);
  const roast = generateRoast(cal, targetCalories, pro, targetProtein);
  if (logs.length === 0) {
    return "AI 代理教練：今日未見打卡，聽日記得記低第一餐，我會再幫你分析！";
  }
  return `AI 代理教練晚間點評：${roast}`;
}

export function buildQuotaMealRecommendations(
  remainingCalories: number,
  remainingProtein: number,
  remainingCarbs: number,
  remainingFats: number
): MealRecommendation[] {
  if (remainingCalories <= 0) {
    return [
      {
        title: "今日額度已用完",
        description: "建議飲清水或無糖茶，明天再調整宏量。",
        estimatedCalories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
      },
    ];
  }

  const combos: MealRecommendation[] = [];

  if (remainingCalories >= 400 && remainingProtein >= 25) {
    combos.push({
      title: "外食高蛋白組合",
      description: "茶餐廳：蒸水蛋 + 去皮雞胸 + 走汁菜心（少油）",
      estimatedCalories: Math.min(remainingCalories, 480),
      protein: Math.min(remainingProtein, 38),
      carbs: Math.min(remainingCarbs, 35),
      fats: Math.min(remainingFats, 14),
    });
  }

  if (remainingCalories >= 300) {
    combos.push({
      title: "便利店輕食",
      description: "雞胸沙律盒 + 無糖豆漿",
      estimatedCalories: Math.min(remainingCalories, 380),
      protein: Math.min(remainingProtein, 32),
      carbs: Math.min(remainingCarbs, 28),
      fats: Math.min(remainingFats, 12),
    });
  }

  if (remainingCalories >= 150 && remainingCarbs >= 20) {
    combos.push({
      title: "碳水補充",
      description: "香蕉 1 條 + 希臘乳酪（無糖）",
      estimatedCalories: Math.min(remainingCalories, 220),
      protein: Math.min(remainingProtein, 12),
      carbs: Math.min(remainingCarbs, 35),
      fats: Math.min(remainingFats, 6),
    });
  }

  combos.push({
    title: "低卡收尾",
    description: "溫蔬菜湯 + 少量堅果（10g）",
    estimatedCalories: Math.min(remainingCalories, 180),
    protein: Math.min(remainingProtein, 8),
    carbs: Math.min(remainingCarbs, 12),
    fats: Math.min(remainingFats, 10),
  });

  return combos.slice(0, 4);
}

export async function enhanceRecommendationsWithAi(
  combos: MealRecommendation[],
  context: string
): Promise<MealRecommendation[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return combos;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "你是香港健身飲食教練，用繁體中文，根據剩餘營養素推薦 2-3 個外食配餐，JSON 陣列 [{title,description,estimatedCalories,protein,carbs,fats}]",
          },
          { role: "user", content: context },
        ],
      }),
    });
    if (!res.ok) return combos;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return combos;
    const parsed = JSON.parse(match[0]) as MealRecommendation[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 4);
  } catch {
    // fallback
  }
  return combos;
}
