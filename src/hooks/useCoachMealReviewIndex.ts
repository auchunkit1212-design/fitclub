"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSessionRequestHeaders } from "@/lib/session";
import { filterRecentCoachReviewLogs } from "@/lib/meal-review-status";
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
      cache: "no-store",
      headers,
    }),
    fetch(`/api/coach/meal-feedback?mealLogIds=${qs}`, {
      credentials: "include",
      cache: "no-store",
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

  const recentLogs = useMemo(
    () => filterRecentCoachReviewLogs(logs),
    [logs]
  );

  const reload = useCallback(async () => {
    if (!coachEmail || recentLogs.length === 0) {
      setReactions([]);
      setFeedback([]);
      return;
    }

    setLoading(true);
    try {
      const ids = recentLogs.map((l) => l.id);
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
  }, [coachEmail, recentLogs]);

  const markMealReviewed = useCallback(
    (mealLogId: string) => {
      if (!coachEmail) return;
      const coach = coachEmail.trim().toLowerCase();

      setFeedback((prev) => {
        if (
          prev.some(
            (f) =>
              f.mealLogId === mealLogId &&
              f.coachEmail.trim().toLowerCase() === coach
          )
        ) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `local-${mealLogId}-${coach}`,
            mealLogId,
            coachEmail,
            presetKey: "local",
            messageText: "",
            createdAt: new Date().toISOString(),
          },
        ];
      });
    },
    [coachEmail]
  );

  const markAllMealsReviewed = useCallback(
    (mealLogIds: string[]) => {
      if (!coachEmail || mealLogIds.length === 0) return;
      const coach = coachEmail.trim().toLowerCase();
      const idSet = new Set(mealLogIds);

      setReactions((prev) => {
        const reviewed = new Set(
          prev
            .filter(
              (r) =>
                idSet.has(r.mealLogId) &&
                r.coachEmail.trim().toLowerCase() === coach
            )
            .map((r) => r.mealLogId)
        );
        const additions = mealLogIds
          .filter((id) => !reviewed.has(id))
          .map((mealLogId) => ({
            id: `local-${mealLogId}-${coach}`,
            mealLogId,
            coachEmail,
            sticker: "clap",
            createdAt: new Date().toISOString(),
          }));
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
    },
    [coachEmail]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    reactions,
    feedback,
    loading,
    reload,
    markMealReviewed,
    markAllMealsReviewed,
  };
}
