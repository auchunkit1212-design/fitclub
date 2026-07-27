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
  macro: "calories" | "protein" | "carbs" | "fats";
  label: string;
  current: number;
  target: number;
  level: ComplianceLevel;
};

export type CoachReportStats = {
  mealCount: number;
  loggedDays: number;
  metDays: number;
  partialDays: number;
  lowDays: number;
  overDays: number;
  avgCalories: number;
  targets: MacroTargets;
  overIssues: DayMacroIssue[];
  lowIssues: DayMacroIssue[];
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

function emptyTotals(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fats: 0 };
}

function groupLogsByDay(logs: MealLog[]): Map<string, MacroTotals & { mealCount: number }> {
  const map = new Map<string, MacroTotals & { mealCount: number }>();
  for (const log of logs) {
    const key = dayKey(log.date);
    const prev = map.get(key) ?? { ...emptyTotals(), mealCount: 0 };
    map.set(key, {
      calories: prev.calories + (log.calories || 0),
      protein: prev.protein + (log.protein || 0),
      carbs: prev.carbs + (log.carbs || 0),
      fats: prev.fats + (log.fats || 0),
      mealCount: prev.mealCount + 1,
    });
  }
  return map;
}

export function buildCoachReportStats(
  logs: MealLog[],
  targets: MacroTargets = DEFAULT_TARGETS
): CoachReportStats {
  const byDay = groupLogsByDay(logs);
  let metDays = 0;
  let partialDays = 0;
  let lowDays = 0;
  let overDays = 0;
  const overIssues: DayMacroIssue[] = [];
  const lowIssues: DayMacroIssue[] = [];

  const softCap = { maxRatio: MACRO_SOFT_MAX_RATIO };
  const dates = Array.from(byDay.keys()).sort();

  for (const date of dates) {
    const day = byDay.get(date)!;
    const calories = macroComplianceLevel(day.calories, targets.calories, softCap);
    const protein = macroComplianceLevel(day.protein, targets.protein);
    const carbs = macroComplianceLevel(day.carbs, targets.carbs, softCap);
    const fats = macroComplianceLevel(day.fats, targets.fats, softCap);
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

    const macros: Array<[DayMacroIssue["macro"], number, number, ComplianceLevel]> = [
      ["calories", day.calories, targets.calories, calories],
      ["protein", day.protein, targets.protein, protein],
      ["carbs", day.carbs, targets.carbs, carbs],
      ["fats", day.fats, targets.fats, fats],
    ];

    for (const [macro, current, target, level] of macros) {
      if (level === "over") {
        overIssues.push({
          date,
          macro,
          label: MACRO_LABEL[macro],
          current,
          target,
          level,
        });
      }
      if (level === "low" || (macro === "protein" && level === "partial")) {
        lowIssues.push({
          date,
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

  return {
    mealCount: logs.length,
    loggedDays: byDay.size,
    metDays,
    partialDays,
    lowDays,
    overDays,
    avgCalories: logs.length > 0 ? Math.round(totalCalories / logs.length) : 0,
    targets,
    overIssues: overIssues.slice(-12).reverse(),
    lowIssues: lowIssues
      .filter((i) => i.macro === "protein" || i.level === "low")
      .slice(-12)
      .reverse(),
  };
}

export function complianceRate(stats: CoachReportStats): number {
  if (stats.loggedDays === 0) return 0;
  return Math.round((stats.metDays / stats.loggedDays) * 100);
}

export { COMPLIANCE_LABEL };
