import type { MealScheduleKey } from "@/lib/personal-settings";

export type TodayStatusKey =
  | "warmingUp"
  | "inProgress"
  | "balanced"
  | "onTrack"
  | "over";

export type FastingPhase = "fasting" | "eating";

export type FastingSnapshot = {
  phase: FastingPhase;
  remainingMs: number;
  progress: number;
  totalPhaseMs: number;
};

export const FASTING_MS = 16 * 60 * 60 * 1000;
export const EATING_MS = 8 * 60 * 60 * 1000;

export function calorieProgressPct(current: number, target: number): number {
  if (target <= 0) return current > 0 ? 100 : 0;
  return Math.max(0, Math.round((current / target) * 100));
}

export function todayStatusFromCaloriePct(pct: number): TodayStatusKey {
  if (pct < 25) return "warmingUp";
  if (pct < 55) return "inProgress";
  if (pct <= 105) return "balanced";
  if (pct <= 115) return "onTrack";
  return "over";
}

export function remainingCalories(
  target: number,
  consumed: number,
  exercise = 0
): number {
  return target - consumed + exercise;
}

export function unboundedPct(current: number, target: number): number {
  if (target <= 0) return current > 0 ? 999 : 0;
  return Math.max(0, Math.round((current / target) * 100));
}

export function expectedMealCount(schedule: MealScheduleKey): number {
  if (schedule === "fasting168") return 2;
  if (schedule === "fourMeals") return 4;
  return 3;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function getDefaultFastingSnapshot(now: Date): FastingSnapshot {
  const startEat = new Date(now);
  startEat.setHours(12, 0, 0, 0);
  const endEat = new Date(now);
  endEat.setHours(20, 0, 0, 0);

  if (now >= startEat && now < endEat) {
    const remainingMs = endEat.getTime() - now.getTime();
    return {
      phase: "eating",
      remainingMs,
      progress: 1 - remainingMs / EATING_MS,
      totalPhaseMs: EATING_MS,
    };
  }

  let fastingEnd = new Date(startEat);
  if (now >= endEat) {
    fastingEnd.setDate(fastingEnd.getDate() + 1);
  }
  const remainingMs = fastingEnd.getTime() - now.getTime();
  return {
    phase: "fasting",
    remainingMs,
    progress: Math.min(1, 1 - remainingMs / FASTING_MS),
    totalPhaseMs: FASTING_MS,
  };
}

export function getFastingSnapshotFromLastMeal(
  now: Date,
  lastMealAt: Date
): FastingSnapshot {
  const fastingEnd = new Date(lastMealAt.getTime() + FASTING_MS);
  if (now < fastingEnd) {
    const remainingMs = fastingEnd.getTime() - now.getTime();
    const elapsed = now.getTime() - lastMealAt.getTime();
    return {
      phase: "fasting",
      remainingMs,
      progress: Math.min(1, Math.max(0, elapsed / FASTING_MS)),
      totalPhaseMs: FASTING_MS,
    };
  }

  const eatingEnd = new Date(fastingEnd.getTime() + EATING_MS);
  if (now < eatingEnd) {
    const remainingMs = eatingEnd.getTime() - now.getTime();
    const elapsed = now.getTime() - fastingEnd.getTime();
    return {
      phase: "eating",
      remainingMs,
      progress: Math.min(1, Math.max(0, elapsed / EATING_MS)),
      totalPhaseMs: EATING_MS,
    };
  }

  const nextFastEnd = new Date(eatingEnd.getTime() + FASTING_MS);
  if (now < nextFastEnd) {
    const remainingMs = nextFastEnd.getTime() - now.getTime();
    const elapsed = now.getTime() - eatingEnd.getTime();
    return {
      phase: "fasting",
      remainingMs,
      progress: Math.min(1, Math.max(0, elapsed / FASTING_MS)),
      totalPhaseMs: FASTING_MS,
    };
  }

  return getDefaultFastingSnapshot(now);
}

export function getFastingSnapshot(
  now: Date,
  lastMealAt?: Date | null
): FastingSnapshot {
  if (lastMealAt && !Number.isNaN(lastMealAt.getTime())) {
    return getFastingSnapshotFromLastMeal(now, lastMealAt);
  }
  return getDefaultFastingSnapshot(now);
}

export function latestMealDate(createdAts: Array<string | undefined>): Date | null {
  const times = createdAts
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => !Number.isNaN(value));
  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}
