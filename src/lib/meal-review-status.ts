import { AI_GORILLA_COACH_EMAIL } from "@/lib/registry-constants";
import type { MealLog, MealLogFeedback, MealLogReaction } from "@/lib/types";

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
  feedback: MealLogFeedback[]
): MealLog[] {
  return logs
    .filter(
      (log) =>
        !isMealReviewedByCoach(log.id, coachEmail, reactions, feedback)
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
