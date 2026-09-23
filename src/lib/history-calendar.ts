import {
  computeTargetProfile,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import { fetchMealLogs, fetchStudentBodyProfile } from "@/lib/db";
import {
  fetchFeedbackForMealIds,
  fetchReactionsForMealIds,
  fetchStudentNutritionTargets,
} from "@/lib/phase4-db";
import {
  buildStudentDailyCompliance,
  type ComplianceLevel,
  sumLogsForDay,
} from "@/lib/nutrition-compliance";
import { AI_GORILLA_COACH_EMAIL } from "@/lib/registry-constants";
import { isValidSticker } from "@/lib/meal-stickers";
import type {
  MealLog,
  MealLogFeedback,
  MealLogReaction,
  RegistryUser,
} from "@/lib/types";

export type DayStatus = ComplianceLevel;

export type HistoryDaySummary = {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  mealCount: number;
  status: DayStatus;
};

export type HistoryMonthStats = {
  logged: number;
  met: number;
  partial: number;
  low: number;
  over: number;
  none: number;
};

export type ResolvedNutritionTargets = {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
};

function minimalStudent(email: string, name?: string): RegistryUser {
  const normalized = email.trim().toLowerCase();
  return {
    email: normalized,
    name: name?.trim() || normalized.split("@")[0] || "學員",
    role: "student",
    gym: "",
  };
}

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

function summarizeMonthStats(days: HistoryDaySummary[]): HistoryMonthStats {
  const stats: HistoryMonthStats = {
    logged: 0,
    met: 0,
    partial: 0,
    low: 0,
    over: 0,
    none: 0,
  };
  for (const day of days) {
    stats[day.status]++;
    if (day.mealCount > 0) stats.logged++;
  }
  return stats;
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
  stats: HistoryMonthStats;
}> {
  const normalized = email.trim().toLowerCase();
  const monthStr = String(month).padStart(2, "0");
  const from = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const [targets, body, coachTargets, logs] = await Promise.all([
    resolveStudentNutritionTargets(normalized),
    fetchStudentBodyProfile(normalized),
    fetchStudentNutritionTargets(normalized),
    fetchMealLogs({ emails: [normalized], from, to }),
  ]);

  const student = minimalStudent(normalized);
  const days: HistoryDaySummary[] = [];

  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${monthStr}-${String(d).padStart(2, "0")}`;
    const totals = sumLogsForDay(logs, normalized, date);
    const mealCount = logs.filter(
      (l) =>
        l.email.trim().toLowerCase() === normalized &&
        l.date.slice(0, 10) === date
    ).length;
    const compliance = buildStudentDailyCompliance({
      student,
      logs,
      coachTargets,
      bodyProfile: body,
      day: date,
    });
    days.push({
      date,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFats: totals.fats,
      mealCount,
      status: compliance.macroLevels.overall,
    });
  }

  return {
    year,
    month,
    targets,
    days,
    stats: summarizeMonthStats(days),
  };
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
  feedback: MealLogFeedback[];
  aiReviews: Array<{
    mealLogId: string;
    text: string;
    createdAt: string;
  }>;
  compliance: {
    overall: ComplianceLevel;
    calories: ComplianceLevel;
    protein: ComplianceLevel;
    carbs: ComplianceLevel;
    fats: ComplianceLevel;
  };
};

export async function fetchHistoryDayDetail(
  email: string,
  date: string
): Promise<HistoryDayDetail> {
  const normalized = email.trim().toLowerCase();
  const [targets, body, coachTargets, logs] = await Promise.all([
    resolveStudentNutritionTargets(normalized),
    fetchStudentBodyProfile(normalized),
    fetchStudentNutritionTargets(normalized),
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
  const mealIds = meals.map((m) => m.id);
  const [reactions, feedback] = await Promise.all([
    fetchReactionsForMealIds(mealIds),
    fetchFeedbackForMealIds(mealIds),
  ]);

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

  const complianceRow = buildStudentDailyCompliance({
    student: minimalStudent(normalized),
    logs,
    coachTargets,
    bodyProfile: body,
    day: date,
  });

  return {
    date,
    targets,
    totals,
    meals,
    reactions,
    feedback,
    aiReviews,
    compliance: {
      overall: complianceRow.macroLevels.overall,
      calories: complianceRow.macroLevels.calories,
      protein: complianceRow.macroLevels.protein,
      carbs: complianceRow.macroLevels.carbs,
      fats: complianceRow.macroLevels.fats,
    },
  };
}
