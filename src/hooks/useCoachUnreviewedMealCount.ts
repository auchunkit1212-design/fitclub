"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useCoachMealReviewIndex } from "@/hooks/useCoachMealReviewIndex";
import {
  fetchMealLogsForSession,
  fetchUsersForSession,
} from "@/lib/db";
import { filterUnreviewedMeals } from "@/lib/meal-review-status";
import { initUserRegistry } from "@/lib/registry";
import { getSession } from "@/lib/session";
import type { MealLog, UserSession } from "@/lib/types";

/** Unreviewed student meal count for coach/admin BottomNav badge. */
export function useCoachUnreviewedMealCount(
  enabled: boolean
): number | undefined {
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);

  const canReview =
    enabled &&
    session != null &&
    (session.role === "coach" || session.role === "admin");

  const reviewIndex = useCoachMealReviewIndex(
    logs,
    canReview ? session.email : null
  );

  const load = useCallback(async () => {
    if (!enabled) {
      setSession(null);
      setLogs([]);
      return;
    }

    const current = getSession();
    if (!current || (current.role !== "coach" && current.role !== "admin")) {
      setSession(null);
      setLogs([]);
      return;
    }

    setSession(current);

    try {
      await initUserRegistry();
      const registry = await fetchUsersForSession(current);
      const mealLogs = await fetchMealLogsForSession(current, registry);
      setLogs(mealLogs);
    } catch {
      setLogs([]);
    }
  }, [enabled, pathname]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => {
    if (!canReview || !session?.email) return undefined;
    return filterUnreviewedMeals(
      logs,
      session.email,
      reviewIndex.reactions,
      reviewIndex.feedback
    ).length;
  }, [
    canReview,
    session?.email,
    logs,
    reviewIndex.reactions,
    reviewIndex.feedback,
  ]);
}
