import { streakDateKey } from "@/lib/streak";

/** Max days in the past a student may backfill a meal log. */
export const MEAL_LOG_MAX_BACKDATE_DAYS = 90;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isMealLogDateString(
  value: string | null | undefined
): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Today in Asia/Hong_Kong as YYYY-MM-DD */
export function mealLogTodayKey(date = new Date()): string {
  return streakDateKey(date);
}

export function mealLogDateToCreatedAt(dateKey: string): string {
  return `${dateKey}T12:00:00.000Z`;
}

export type MealLogDateValidation =
  | { ok: true; dateKey: string; isToday: boolean; createdAt: string }
  | { ok: false; error: string };

/**
 * Validate optional log date for meal insert.
 * Empty / omitted → today. Future dates rejected. Older than max window rejected.
 */
export function validateMealLogDate(
  raw: string | null | undefined,
  options?: { todayKey?: string; maxBackdateDays?: number }
): MealLogDateValidation {
  const todayKey = options?.todayKey ?? mealLogTodayKey();
  const maxDays = options?.maxBackdateDays ?? MEAL_LOG_MAX_BACKDATE_DAYS;
  const trimmed = raw?.trim() ?? "";

  if (!trimmed) {
    return {
      ok: true,
      dateKey: todayKey,
      isToday: true,
      createdAt: mealLogDateToCreatedAt(todayKey),
    };
  }

  if (!isMealLogDateString(trimmed)) {
    return { ok: false, error: "日期格式無效，請用 YYYY-MM-DD" };
  }

  if (trimmed > todayKey) {
    return { ok: false, error: "唔可以記錄未來日子" };
  }

  const today = new Date(`${todayKey}T12:00:00Z`);
  const target = new Date(`${trimmed}T12:00:00Z`);
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000
  );
  if (diffDays > maxDays) {
    return {
      ok: false,
      error: `只可以補記最近 ${maxDays} 日內嘅飲食`,
    };
  }

  return {
    ok: true,
    dateKey: trimmed,
    isToday: trimmed === todayKey,
    createdAt: mealLogDateToCreatedAt(trimmed),
  };
}
