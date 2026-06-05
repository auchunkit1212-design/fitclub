import {
  computeTargetProfile,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import { fetchMealLogs, fetchStudentBodyProfile } from "@/lib/db";
import { fetchReactionsForMealIds, fetchStudentNutritionTargets } from "@/lib/phase4-db";
import { sumLogsForDay } from "@/lib/nutrition-compliance";
import { AI_GORILLA_COACH_EMAIL } from "@/lib/registry-constants";
import { isValidSticker } from "@/lib/meal-stickers";
import type { MealLog, MealLogReaction } from "@/lib/types";

export type DayStatus = "under" | "over" | "none";

export type HistoryDaySummary = {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  mealCount: number;
  status: DayStatus;
};

export type ResolvedNutritionTargets = {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
};

export async function resolveStudentNutritionTargets(
  email: string
): Promise<ResolvedNutritionTargets> {
  const normalized = email.trim().toLowerCase();
  const coachTargets = await fetchStudentNutritionTargets(normalized);
  if (coachTargets?.locked) {
    return {
      targetCalories: coachTargets.targetCalories,
      targetProtein: coachTargets.targetProtein,
      targetCarbs: coachTargets.targetCarbs,
      targetFats: coachTargets.targetFats,
    };
  }

  const body = await fetchStudentBodyProfile(normalized);
  if (body && isBodyProfileComplete(body)) {
    const computed = computeTargetProfile(body);
    const cal = computed.targetCalories;
    return {
      targetCalories: cal,
      targetProtein: computed.targetProtein,
      targetCarbs: Math.round(cal * 0.4 / 4),
      targetFats: Math.round(cal * 0.28 / 9),
    };
  }

  return {
    targetCalories: 2000,
    targetProtein: 120,
    targetCarbs: 200,
    targetFats: 65,
  };
}

function dayStatus(
  totalCalories: number,
  mealCount: number,
  targetCalories: number
): DayStatus {
  if (mealCount === 0) return "none";
  if (totalCalories <= targetCalories) return "under";
  return "over";
}

export async function fetchHistoryMonthSummary(
  email: string,
  year: number,
  month: number
): Promise<{
  year: number;
  month: number;
  targets: ResolvedNutritionTargets;
  days: HistoryDaySummary[];
}> {
  const normalized = email.trim().toLowerCase();
  const monthStr = String(month).padStart(2, "0");
  const from = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const [targets, logs] = await Promise.all([
    resolveStudentNutritionTargets(normalized),
    fetchMealLogs({ emails: [normalized], from, to }),
  ]);

  const days: HistoryDaySummary[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${monthStr}-${String(d).padStart(2, "0")}`;
    const totals = sumLogsForDay(logs, normalized, date);
    const mealCount = logs.filter(
      (l) =>
        l.email.trim().toLowerCase() === normalized &&
        l.date.slice(0, 10) === date
    ).length;
    days.push({
      date,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFats: totals.fats,
      mealCount,
      status: dayStatus(totals.calories, mealCount, targets.targetCalories),
    });
  }

  return { year, month, targets, days };
}

export type HistoryDayDetail = {
  date: string;
  targets: ResolvedNutritionTargets;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  meals: MealLog[];
  reactions: MealLogReaction[];
  aiReviews: Array<{
    mealLogId: string;
    text: string;
    createdAt: string;
  }>;
};

export async function fetchHistoryDayDetail(
  email: string,
  date: string
): Promise<HistoryDayDetail> {
  const normalized = email.trim().toLowerCase();
  const [targets, logs] = await Promise.all([
    resolveStudentNutritionTargets(normalized),
    fetchMealLogs({ emails: [normalized], from: date, to: date }),
  ]);

  const meals = logs
    .filter(
      (l) =>
        l.email.trim().toLowerCase() === normalized &&
        l.date.slice(0, 10) === date
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  const totals = sumLogsForDay(logs, normalized, date);
  const reactions = await fetchReactionsForMealIds(meals.map((m) => m.id));

  const aiReviews = reactions
    .filter(
      (r) =>
        r.coachEmail.trim().toLowerCase() ===
          AI_GORILLA_COACH_EMAIL.toLowerCase() || !isValidSticker(r.sticker)
    )
    .map((r) => ({
      mealLogId: r.mealLogId,
      text: r.sticker,
      createdAt: r.createdAt,
    }));

  return {
    date,
    targets,
    totals,
    meals,
    reactions,
    aiReviews,
  };
}
