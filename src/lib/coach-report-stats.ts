import {
  COMPLIANCE_LABEL,
  MACRO_SOFT_MAX_RATIO,
  macroComplianceLevel,
  overallMacroLevel,
  type ComplianceLevel,
  type MacroTargets,
  type MacroTotals,
} from "@/lib/nutrition-compliance";
import type { MealLog } from "@/lib/types";

const DEFAULT_TARGETS: MacroTargets = {
  calories: 2000,
  protein: 120,
  carbs: 200,
  fats: 65,
};

export { DEFAULT_TARGETS };

export type DayMacroIssue = {
  date: string;
  studentEmail: string;
  studentName: string;
  macro: "calories" | "protein" | "carbs" | "fats";
  label: string;
  current: number;
  target: number;
  level: ComplianceLevel;
};

export type CoachReportStats = {
  mealCount: number;
  /** Distinct student-days with at least one meal */
  loggedDays: number;
  metDays: number;
  partialDays: number;
  lowDays: number;
  overDays: number;
  avgCalories: number;
  targets: MacroTargets;
  studentCount: number;
  overIssues: DayMacroIssue[];
  lowIssues: DayMacroIssue[];
};

export type BuildCoachReportOptions = {
  /** email (lowercase) → display name */
  nameByEmail?: Record<string, string>;
  /** email (lowercase) → personal targets; falls back to `targets` */
  targetsByEmail?: Record<string, MacroTargets>;
};

const MACRO_LABEL: Record<DayMacroIssue["macro"], string> = {
  calories: "熱量",
  protein: "蛋白質",
  carbs: "碳水",
  fats: "脂肪",
};

function dayKey(date: string): string {
  return date.slice(0, 10);
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

function emptyTotals(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fats: 0 };
}

type StudentDayBucket = MacroTotals & {
  mealCount: number;
  email: string;
  date: string;
};

/** Group by student + calendar day — never sum multiple students into one day. */
function groupLogsByStudentDay(logs: MealLog[]): Map<string, StudentDayBucket> {
  const map = new Map<string, StudentDayBucket>();
  for (const log of logs) {
    const email = emailKey(log.email);
    if (!email) continue;
    const date = dayKey(log.date);
    const key = `${email}|${date}`;
    const prev = map.get(key) ?? {
      ...emptyTotals(),
      mealCount: 0,
      email,
      date,
    };
    map.set(key, {
      email,
      date,
      calories: prev.calories + (log.calories || 0),
      protein: prev.protein + (log.protein || 0),
      carbs: prev.carbs + (log.carbs || 0),
      fats: prev.fats + (log.fats || 0),
      mealCount: prev.mealCount + 1,
    });
  }
  return map;
}

function resolveName(
  email: string,
  nameByEmail?: Record<string, string>
): string {
  return nameByEmail?.[email]?.trim() || email || "學員";
}

export function buildCoachReportStats(
  logs: MealLog[],
  targets: MacroTargets = DEFAULT_TARGETS,
  options?: BuildCoachReportOptions
): CoachReportStats {
  const byStudentDay = groupLogsByStudentDay(logs);
  let metDays = 0;
  let partialDays = 0;
  let lowDays = 0;
  let overDays = 0;
  const overIssues: DayMacroIssue[] = [];
  const lowIssues: DayMacroIssue[] = [];

  const softCap = { maxRatio: MACRO_SOFT_MAX_RATIO };
  const buckets = Array.from(byStudentDay.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.email.localeCompare(b.email);
  });

  for (const day of buckets) {
    const studentTargets =
      options?.targetsByEmail?.[day.email] ?? targets;
    const studentName = resolveName(day.email, options?.nameByEmail);

    const calories = macroComplianceLevel(
      day.calories,
      studentTargets.calories,
      softCap
    );
    const protein = macroComplianceLevel(day.protein, studentTargets.protein);
    const carbs = macroComplianceLevel(
      day.carbs,
      studentTargets.carbs,
      softCap
    );
    const fats = macroComplianceLevel(day.fats, studentTargets.fats, softCap);
    const overall = overallMacroLevel(
      calories,
      protein,
      carbs,
      fats,
      day.mealCount
    );

    if (overall === "met") metDays += 1;
    else if (overall === "partial") partialDays += 1;
    else if (overall === "low") lowDays += 1;
    else if (overall === "over") overDays += 1;

    const macros: Array<
      [DayMacroIssue["macro"], number, number, ComplianceLevel]
    > = [
      ["calories", day.calories, studentTargets.calories, calories],
      ["protein", day.protein, studentTargets.protein, protein],
      ["carbs", day.carbs, studentTargets.carbs, carbs],
      ["fats", day.fats, studentTargets.fats, fats],
    ];

    for (const [macro, current, target, level] of macros) {
      if (level === "over") {
        overIssues.push({
          date: day.date,
          studentEmail: day.email,
          studentName,
          macro,
          label: MACRO_LABEL[macro],
          current,
          target,
          level,
        });
      }
      if (level === "low" || (macro === "protein" && level === "partial")) {
        lowIssues.push({
          date: day.date,
          studentEmail: day.email,
          studentName,
          macro,
          label: MACRO_LABEL[macro],
          current,
          target,
          level,
        });
      }
    }
  }

  const totalCalories = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const studentCount = new Set(
    logs.map((l) => emailKey(l.email)).filter(Boolean)
  ).size;

  return {
    mealCount: logs.length,
    loggedDays: byStudentDay.size,
    metDays,
    partialDays,
    lowDays,
    overDays,
    avgCalories: logs.length > 0 ? Math.round(totalCalories / logs.length) : 0,
    targets,
    studentCount,
    overIssues: overIssues.slice(-16).reverse(),
    lowIssues: lowIssues
      .filter((i) => i.macro === "protein" || i.level === "low")
      .slice(-16)
      .reverse(),
  };
}

export function complianceRate(stats: CoachReportStats): number {
  if (stats.loggedDays === 0) return 0;
  return Math.round((stats.metDays / stats.loggedDays) * 100);
}

export { COMPLIANCE_LABEL };
