"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readReviewCache,
  reviewLogIdsKey,
  writeReviewCache,
} from "@/lib/coach-students-cache";
import { getSessionRequestHeaders } from "@/lib/session";
import { fetchWithTimeout } from "@/lib/with-timeout";
import { filterRecentCoachReviewLogs } from "@/lib/meal-review-status";
import type { MealLog, MealLogFeedback, MealLogReaction } from "@/lib/types";

type ReloadOptions = { silent?: boolean };

function mergeById<T extends { id: string }>(
  server: T[],
  localKeep: T[]
): T[] {
  if (localKeep.length === 0) return server;
  const ids = new Set(server.map((item) => item.id));
  return [...server, ...localKeep.filter((item) => !ids.has(item.id))];
}

async function fetchReviewStatus(mealLogIds: string[]): Promise<{
  reactions: MealLogReaction[];
  feedback: MealLogFeedback[];
}> {
  if (mealLogIds.length === 0) {
    return { reactions: [], feedback: [] };
  }

  const res = await fetchWithTimeout("/api/coach/review-status", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getSessionRequestHeaders(),
    },
    body: JSON.stringify({ mealLogIds }),
  });

  if (!res.ok) {
    return { reactions: [], feedback: [] };
  }

  const data = (await res.json()) as {
    reactions?: MealLogReaction[];
    feedback?: MealLogFeedback[];
  };
  return {
    reactions: data.reactions ?? [],
    feedback: data.feedback ?? [],
  };
}

export function useCoachMealReviewIndex(
  logs: MealLog[],
  coachEmail?: string | null
) {
  const recentLogs = useMemo(
    () => filterRecentCoachReviewLogs(logs),
    [logs]
  );
  const idsKey = useMemo(
    () => reviewLogIdsKey(recentLogs.map((log) => log.id)),
    [recentLogs]
  );

  const cached =
    coachEmail && idsKey
      ? readReviewCache(coachEmail, idsKey)
      : null;

  const [reactions, setReactions] = useState<MealLogReaction[]>(
    cached?.reactions ?? []
  );
  const [feedback, setFeedback] = useState<MealLogFeedback[]>(
    cached?.feedback ?? []
  );
  const [loading, setLoading] = useState(
    Boolean(coachEmail) && recentLogs.length > 0 && !cached
  );
  const localIdsRef = useRef<Set<string>>(new Set());
  const hasDataRef = useRef(Boolean(cached));

  const reload = useCallback(
    async (options?: ReloadOptions) => {
      if (!coachEmail) {
        setReactions([]);
        setFeedback([]);
        setLoading(false);
        return;
      }

      const ids = idsKey ? idsKey.split("|").filter(Boolean) : [];
      if (ids.length === 0) {
        setReactions([]);
        setFeedback([]);
        setLoading(false);
        return;
      }

      const silent = Boolean(options?.silent);
      if (!silent && !hasDataRef.current) setLoading(true);

      try {
        const batch = await fetchReviewStatus(ids);
        let nextReactions: MealLogReaction[] = [];
        let nextFeedback: MealLogFeedback[] = [];
        setReactions((prev) => {
          nextReactions = mergeById(
            batch.reactions,
            prev.filter((item) => localIdsRef.current.has(item.id))
          );
          return nextReactions;
        });
        setFeedback((prev) => {
          nextFeedback = mergeById(
            batch.feedback,
            prev.filter((item) => localIdsRef.current.has(item.id))
          );
          return nextFeedback;
        });
        writeReviewCache({
          email: coachEmail,
          reactions: nextReactions,
          feedback: nextFeedback,
          logIdsKey: idsKey,
        });
        hasDataRef.current = true;
      } catch {
        if (!silent) {
          setReactions([]);
          setFeedback([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [coachEmail, idsKey]
  );

  const markMealReviewed = useCallback(
    (mealLogId: string, kind: "sticker" | "feedback" = "feedback") => {
      if (!coachEmail) return;
      const coach = coachEmail.trim().toLowerCase();
      const localId = `local-${kind}-${mealLogId}-${coach}`;
      localIdsRef.current.add(localId);

      if (kind === "sticker") {
        setReactions((prev) => {
          if (
            prev.some(
              (item) =>
                item.mealLogId === mealLogId &&
                item.coachEmail.trim().toLowerCase() === coach
            )
          ) {
            return prev;
          }
          return [
            ...prev,
            {
              id: localId,
              mealLogId,
              coachEmail,
              sticker: "local",
              createdAt: new Date().toISOString(),
            },
          ];
        });
        return;
      }

      setFeedback((prev) => {
        if (
          prev.some(
            (item) =>
              item.mealLogId === mealLogId &&
              item.coachEmail.trim().toLowerCase() === coach
          )
        ) {
          return prev;
        }
        return [
          ...prev,
          {
            id: localId,
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

  useEffect(() => {
    if (!coachEmail) return;
    if (cached && cached.logIdsKey === idsKey) {
      setReactions(cached.reactions);
      setFeedback(cached.feedback);
      setLoading(false);
      void reload({ silent: true });
      return;
    }
    void reload();
    // Intentionally only refetch when the meal id set or coach changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachEmail, idsKey]);

  useEffect(() => {
    if (!coachEmail || !idsKey || !hasDataRef.current) return;
    writeReviewCache({
      email: coachEmail,
      reactions,
      feedback,
      logIdsKey: idsKey,
    });
  }, [coachEmail, idsKey, reactions, feedback]);

  return useMemo(
    () => ({ reactions, feedback, loading, reload, markMealReviewed }),
    [reactions, feedback, loading, reload, markMealReviewed]
  );
}
