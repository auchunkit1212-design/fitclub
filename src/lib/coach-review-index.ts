import {
  fetchFeedbackForMealIds,
  fetchReactionsForMealIds,
} from "@/lib/phase4-db";
import type { MealLogFeedback, MealLogReaction } from "@/lib/types";

const CHUNK = 80;

export async function fetchReviewIndexForMealIds(mealLogIds: string[]): Promise<{
  reactions: MealLogReaction[];
  feedback: MealLogFeedback[];
}> {
  const ids = mealLogIds.filter(Boolean).slice(0, 400);
  if (ids.length === 0) return { reactions: [], feedback: [] };

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    chunks.push(ids.slice(i, i + CHUNK));
  }

  const batches = await Promise.all(
    chunks.map(async (chunk) => {
      const [reactions, feedback] = await Promise.all([
        fetchReactionsForMealIds(chunk),
        fetchFeedbackForMealIds(chunk),
      ]);
      return { reactions, feedback };
    })
  );

  return {
    reactions: batches.flatMap((b) => b.reactions),
    feedback: batches.flatMap((b) => b.feedback),
  };
}
