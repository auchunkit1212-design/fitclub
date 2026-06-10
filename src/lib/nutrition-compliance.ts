import {
  computeTargetProfile,
  estimateMicronutrients,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import { getRecommendedMicronutrientTargets } from "@/lib/micronutrient-targets";
import { AI_GORILLA_COACH_EMAIL } from "@/lib/registry-constants";
import type {
  MealLog,
  RegistryUser,
  StudentBodyProfile,
  StudentNutritionTargets,
} from "@/lib/types";

export type ComplianceLevel = "met" | "partial" | "low" | "over" | "none";

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export function todayDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function sumLogsForDay(
  logs: MealLog[],
  email: string,
  day = todayDateKey()
): MacroTotals {
  const normalized = email.trim().toLowerCase();
  return logs
    .filter(
      (l) =>
        l.email.trim().toLowerCase() === normalized &&
        l.date.slice(0, 10) === day
    )
    .reduce(
      (acc, l) => ({
        calories: acc.calories + (l.calories || 0),
        protein: acc.protein + (l.protein || 0),
        carbs: acc.carbs + (l.carbs || 0),
        fats: acc.fats + (l.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
}

export function macroComplianceLevel(
  current: number,
  target: number,
  options?: { minRatio?: number; metRatio?: number }
): ComplianceLevel {
  if (target <= 0) return "none";
  const minR = options?.minRatio ?? 0.5;
  const metR = options?.metRatio ?? 0.9;
  const ratio = current / target;
  if (ratio >= metR) return "met";
  if (ratio >= minR) return "partial";
  return "low";
}

export function maxLimitComplianceLevel(
  current: number,
  max: number
): ComplianceLevel {
  if (max <= 0) return "none";
  if (current <= max * 0.85) return "met";
  if (current <= max) return "partial";
  return "over";
}

export function minTargetComplianceLevel(
  current: number,
  min: number
): ComplianceLevel {
  if (min <= 0) return "none";
  if (current >= min) return "met";
  if (current >= min * 0.6) return "partial";
  return "low";
}

export function overallMacroLevel(
  calories: ComplianceLevel,
  protein: ComplianceLevel,
  carbs: ComplianceLevel,
  fats: ComplianceLevel,
  mealCount: number
): ComplianceLevel {
  if (mealCount === 0) return "none";
  const levels = [calories, protein, carbs, fats].filter((l) => l !== "none");
  if (levels.every((l) => l === "met")) return "met";
  if (levels.some((l) => l === "low")) return "low";
  if (levels.some((l) => l === "partial")) return "partial";
  return "met";
}

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type TargetsSource = "coach" | "ai" | "default";

export type ResolvedStudentTargets = {
  active: MacroTargets;
  activeSource: TargetsSource;
  coach: MacroTargets | null;
  coachLocked: boolean;
  ai: MacroTargets | null;
  aiFromBody: boolean;
};

const DEFAULT_TARGETS: MacroTargets = {
  calories: 2000,
  protein: 120,
  carbs: 200,
  fats: 65,
};

export function isAiCoachEmail(email?: string | null): boolean {
  return (
    email?.trim().toLowerCase() === AI_GORILLA_COACH_EMAIL.toLowerCase()
  );
}

export function targetsFromNutritionRow(
  row: StudentNutritionTargets
): MacroTargets {
  return {
    calories: row.targetCalories,
    protein: row.targetProtein,
    carbs: row.targetCarbs,
    fats: row.targetFats,
  };
}

/** Body-profile TDEE split (same as history calendar). */
export function computeAiTargetsFromBody(
  body: StudentBodyProfile
): MacroTargets {
  const computed = computeTargetProfile(body);
  const cal = computed.targetCalories;
  return {
    calories: cal,
    protein: computed.targetProtein,
    carbs: Math.round((cal * 0.4) / 4),
    fats: Math.round((cal * 0.28) / 9),
  };
}

export function resolveStudentTargetSnapshots(input: {
  storedTargets?: StudentNutritionTargets | null;
  bodyProfile?: StudentBodyProfile | null;
}): ResolvedStudentTargets {
  const bodyAi =
    input.bodyProfile && isBodyProfileComplete(input.bodyProfile)
      ? computeAiTargetsFromBody(input.bodyProfile)
      : null;

  let coach: MacroTargets | null = null;
  let coachLocked = false;
  let ai: MacroTargets | null = bodyAi;
  let aiFromBody = Boolean(bodyAi);

  const stored = input.storedTargets;
  if (stored?.targetCalories) {
    const snapshot = targetsFromNutritionRow(stored);
    if (isAiCoachEmail(stored.setByCoachEmail)) {
      ai = snapshot;
      aiFromBody = false;
    } else {
      coach = snapshot;
      coachLocked = Boolean(stored.locked);
    }
  }

  let active: MacroTargets;
  let activeSource: TargetsSource;

  if (stored?.locked && stored.targetCalories) {
    active = targetsFromNutritionRow(stored);
    activeSource = isAiCoachEmail(stored.setByCoachEmail) ? "ai" : "coach";
  } else if (bodyAi) {
    active = bodyAi;
    activeSource = "ai";
  } else {
    active = DEFAULT_TARGETS;
    activeSource = "default";
  }

  return {
    active,
    activeSource,
    coach,
    coachLocked,
    ai,
    aiFromBody,
  };
}

export type StudentDailyComplianceRow = {
  email: string;
  name: string;
  mealCount: number;
  totals: MacroTotals;
  targets: MacroTargets;
  targetSnapshots: ResolvedStudentTargets;
  macroLevels: {
    calories: ComplianceLevel;
    protein: ComplianceLevel;
    carbs: ComplianceLevel;
    fats: ComplianceLevel;
    overall: ComplianceLevel;
  };
  micro: {
    fiberG: number;
    sugarG: number;
    saturatedFatG: number;
    sodiumMg: number;
    cholesterolMg: number;
  };
  microTargets: ReturnType<typeof getRecommendedMicronutrientTargets>;
  microLevels: {
    fiber: ComplianceLevel;
    sugar: ComplianceLevel;
    saturatedFat: ComplianceLevel;
    sodium: ComplianceLevel;
    cholesterol: ComplianceLevel;
  };
  targetsSource: TargetsSource;
};

export function resolveStudentTargets(
  _student: RegistryUser,
  coachTargets: StudentNutritionTargets | null | undefined,
  bodyProfile?: StudentBodyProfile | null
): MacroTargets {
  return resolveStudentTargetSnapshots({
    storedTargets: coachTargets,
    bodyProfile,
  }).active;
}

export function buildStudentDailyCompliance(input: {
  student: RegistryUser;
  logs: MealLog[];
  coachTargets?: StudentNutritionTargets | null;
  bodyProfile?: StudentBodyProfile | null;
  day?: string;
}): StudentDailyComplianceRow {
  const day = input.day ?? todayDateKey();
  const totals = sumLogsForDay(input.logs, input.student.email, day);
  const mealCount = input.logs.filter(
    (l) =>
      l.email.trim().toLowerCase() ===
        input.student.email.trim().toLowerCase() &&
      l.date.slice(0, 10) === day
  ).length;

  const targetSnapshots = resolveStudentTargetSnapshots({
    storedTargets: input.coachTargets,
    bodyProfile: input.bodyProfile,
  });
  const targets = targetSnapshots.active;
  const targetsSource = targetSnapshots.activeSource;

  const macroLevels = {
    calories: macroComplianceLevel(totals.calories, targets.calories),
    protein: macroComplianceLevel(totals.protein, targets.protein),
    carbs: macroComplianceLevel(totals.carbs, targets.carbs),
    fats: macroComplianceLevel(totals.fats, targets.fats),
    overall: "none" as ComplianceLevel,
  };
  macroLevels.overall = overallMacroLevel(
    macroLevels.calories,
    macroLevels.protein,
    macroLevels.carbs,
    macroLevels.fats,
    mealCount
  );

  const micro = estimateMicronutrients(
    totals.calories,
    totals.carbs,
    totals.fats,
    totals.protein
  );
  const microTargets = getRecommendedMicronutrientTargets({
    targetCalories: targets.calories,
    targetCarbs: targets.carbs,
    targetFats: targets.fats,
  });

  const microLevels = {
    fiber: minTargetComplianceLevel(micro.fiberG, microTargets.fiberGMin),
    sugar: maxLimitComplianceLevel(micro.sugarG, microTargets.sugarGMax),
    saturatedFat: maxLimitComplianceLevel(
      micro.satFatG,
      microTargets.saturatedFatGMax
    ),
    sodium: maxLimitComplianceLevel(micro.sodiumMg, microTargets.sodiumMgMax),
    cholesterol: maxLimitComplianceLevel(
      micro.cholesterolMg,
      microTargets.cholesterolMgMax
    ),
  };

  return {
    email: input.student.email,
    name: input.student.name,
    mealCount,
    totals,
    targets,
    targetSnapshots,
    macroLevels,
    micro: {
      fiberG: micro.fiberG,
      sugarG: micro.sugarG,
      saturatedFatG: micro.satFatG,
      sodiumMg: micro.sodiumMg,
      cholesterolMg: micro.cholesterolMg,
    },
    microTargets,
    microLevels,
    targetsSource,
  };
}

export const TARGET_SOURCE_LABEL: Record<TargetsSource, string> = {
  coach: "教練聖旨",
  ai: "AI 建議",
  default: "預設目標",
};

export const COMPLIANCE_LABEL: Record<ComplianceLevel, string> = {
  met: "達標",
  partial: "注意",
  low: "未達",
  over: "超標",
  none: "未打卡",
};

export const COMPLIANCE_CLASS: Record<ComplianceLevel, string> = {
  met: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  low: "bg-rose-100 text-rose-800",
  over: "bg-orange-100 text-orange-900",
  none: "bg-zinc-100 text-zinc-500",
};
