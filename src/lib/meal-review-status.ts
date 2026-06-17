import { AI_GORILLA_COACH_EMAIL } from "@/lib/registry-constants";
import type { MealLog, MealLogFeedback, MealLogReaction } from "@/lib/types";

/** Coach review badge / API index window (days). */
export const COACH_REVIEW_RECENT_DAYS = 14;

function cutoffDateIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Meal logs within the coach review window (default 14 days). */
export function filterRecentCoachReviewLogs(
  logs: MealLog[],
  options?: { days?: number }
): MealLog[] {
  const days = options?.days ?? COACH_REVIEW_RECENT_DAYS;
  const cutoff = cutoffDateIso(days);
  return logs.filter((log) => log.date.slice(0, 10) >= cutoff);
}

export function isHumanCoachReviewer(email: string): boolean {
  return (
    email.trim().toLowerCase() !== AI_GORILLA_COACH_EMAIL.toLowerCase()
  );
}

export function isMealReviewedByCoach(
  mealLogId: string,
  coachEmail: string,
  reactions: MealLogReaction[],
  feedback: MealLogFeedback[]
): boolean {
  const coach = coachEmail.trim().toLowerCase();
  if (!coach) return false;

  if (
    feedback.some(
      (f) =>
        f.mealLogId === mealLogId &&
        f.coachEmail.trim().toLowerCase() === coach
    )
  ) {
    return true;
  }

  return reactions.some(
    (r) =>
      r.mealLogId === mealLogId &&
      r.coachEmail.trim().toLowerCase() === coach &&
      isHumanCoachReviewer(r.coachEmail)
  );
}

export function filterUnreviewedMeals(
  logs: MealLog[],
  coachEmail: string,
  reactions: MealLogReaction[],
  feedback: MealLogFeedback[],
  options?: { days?: number }
): MealLog[] {
  const recent = filterRecentCoachReviewLogs(logs, options);
  return recent
    .filter(
      (log) =>
        !isMealReviewedByCoach(log.id, coachEmail, reactions, feedback)
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
