"use client";

import { useCallback, useEffect, useState } from "react";
import { getSessionRequestHeaders } from "@/lib/session";
import type { MealLog, MealLogFeedback, MealLogReaction } from "@/lib/types";

const CHUNK_SIZE = 80;

async function fetchReviewChunk(mealLogIds: string[]): Promise<{
  reactions: MealLogReaction[];
  feedback: MealLogFeedback[];
}> {
  if (mealLogIds.length === 0) {
    return { reactions: [], feedback: [] };
  }

  const qs = encodeURIComponent(mealLogIds.join(","));
  const headers = getSessionRequestHeaders();
  const [reactionRes, feedbackRes] = await Promise.all([
    fetch(`/api/coach/reactions?mealLogIds=${qs}`, {
      credentials: "include",
      headers,
    }),
    fetch(`/api/coach/meal-feedback?mealLogIds=${qs}`, {
      credentials: "include",
      headers,
    }),
  ]);

  const reactionData = reactionRes.ok
    ? ((await reactionRes.json()) as { reactions?: MealLogReaction[] })
    : { reactions: [] };
  const feedbackData = feedbackRes.ok
    ? ((await feedbackRes.json()) as { feedback?: MealLogFeedback[] })
    : { feedback: [] };

  return {
    reactions: reactionData.reactions ?? [],
    feedback: feedbackData.feedback ?? [],
  };
}

export function useCoachMealReviewIndex(
  logs: MealLog[],
  coachEmail?: string | null
) {
  const [reactions, setReactions] = useState<MealLogReaction[]>([]);
  const [feedback, setFeedback] = useState<MealLogFeedback[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!coachEmail || logs.length === 0) {
      setReactions([]);
      setFeedback([]);
      return;
    }

    setLoading(true);
    try {
      const ids = logs.map((l) => l.id);
      const allReactions: MealLogReaction[] = [];
      const allFeedback: MealLogFeedback[] = [];

      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const batch = await fetchReviewChunk(chunk);
        allReactions.push(...batch.reactions);
        allFeedback.push(...batch.feedback);
      }

      setReactions(allReactions);
      setFeedback(allFeedback);
    } catch {
      setReactions([]);
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  }, [coachEmail, logs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { reactions, feedback, loading, reload };
}
