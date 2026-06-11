"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoachMealRatingValue } from "@/lib/meal-rating";
import { getSessionRequestHeaders } from "@/lib/session";
import type { MealLogRating } from "@/lib/types";

export function useMealRatings(mealLogIds: string[]) {
  const [ratings, setRatings] = useState<MealLogRating[]>([]);
  const [loading, setLoading] = useState(false);

  const idsKey = useMemo(
    () => Array.from(new Set(mealLogIds.filter(Boolean))).sort().join(","),
    [mealLogIds]
  );

  const reload = useCallback(async () => {
    if (!idsKey) {
      setRatings([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/coach/meal-rating?mealLogIds=${encodeURIComponent(idsKey)}`,
        {
          credentials: "include",
          cache: "no-store",
          headers: getSessionRequestHeaders(),
        }
      );
      const data = (await res.json()) as { ratings?: MealLogRating[] };
      if (res.ok && data.ratings) {
        setRatings(data.ratings);
      }
    } catch {
      // keep previous ratings
    } finally {
      setLoading(false);
    }
  }, [idsKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ratingByMealId = useMemo(() => {
    const map = new Map<string, CoachMealRatingValue>();
    for (const row of ratings) {
      map.set(row.mealLogId, row.rating);
    }
    return map;
  }, [ratings]);

  const applyRating = useCallback((row: MealLogRating) => {
    setRatings((prev) => {
      const rest = prev.filter((r) => r.mealLogId !== row.mealLogId);
      return [...rest, row];
    });
  }, []);

  return { ratings, ratingByMealId, loading, reload, applyRating };
}
