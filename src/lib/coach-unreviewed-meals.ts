import type { MealLog } from "@/lib/types";

const DEFAULT_DAYS = 14;

function cutoffDateIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function studentEmailSet(studentEmails: string[]): Set<string> {
  return new Set(studentEmails.map((e) => e.toLowerCase()));
}

function ratedMealIdSet(
  ratedMealIds: Set<string> | Iterable<string>
): Set<string> {
  return ratedMealIds instanceof Set ? ratedMealIds : new Set(ratedMealIds);
}

/** Meal logs from the coach's students within the recent window (default 14 days). */
export function filterRecentStudentLogs(
  logs: MealLog[],
  studentEmails: string[],
  options?: { days?: number }
): MealLog[] {
  const days = options?.days ?? DEFAULT_DAYS;
  const cutoff = cutoffDateIso(days);
  const emails = studentEmailSet(studentEmails);

  return logs.filter((log) => {
    const logDate = log.date.slice(0, 10);
    return logDate >= cutoff && emails.has(log.email.toLowerCase());
  });
}

/** Count student meal logs in the recent window without a coach rating. */
export function countUnreviewedMeals(
  logs: MealLog[],
  studentEmails: string[],
  ratedMealIds: Set<string> | Iterable<string>,
  options?: { days?: number }
): number {
  const rated = ratedMealIdSet(ratedMealIds);
  return filterRecentStudentLogs(logs, studentEmails, options).filter(
    (log) => !rated.has(log.id)
  ).length;
}

/** Per-student unreviewed meal counts (email keys are lowercased). */
export function unreviewedByStudentEmail(
  logs: MealLog[],
  studentEmails: string[],
  ratedMealIds: Set<string> | Iterable<string>,
  options?: { days?: number }
): Map<string, number> {
  const rated = ratedMealIdSet(ratedMealIds);
  const map = new Map<string, number>();

  for (const log of filterRecentStudentLogs(logs, studentEmails, options)) {
    if (rated.has(log.id)) continue;
    const email = log.email.toLowerCase();
    map.set(email, (map.get(email) ?? 0) + 1);
  }

  return map;
}
