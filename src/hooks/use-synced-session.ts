"use client";

import { useCallback, useEffect, useState } from "react";
import { syncSessionPlan } from "@/lib/plan-client";
import { getSession } from "@/lib/session";
import type { UserSession } from "@/lib/types";

const PLAN_SYNC_EVENT = "fitclub:plan-synced";

/** 從 API 同步 plan／isPro，並在頁面重新聚焦時更新 */
export function useSyncedSession(): UserSession | null {
  const [session, setSession] = useState<UserSession | null>(null);

  const refresh = useCallback(async () => {
    const current = getSession();
    if (!current?.email) {
      setSession(null);
      return;
    }
    const synced = (await syncSessionPlan()) ?? current;
    setSession(synced);
  }, []);

  useEffect(() => {
    void refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onPlanSynced = () => void refresh();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(PLAN_SYNC_EVENT, onPlanSynced);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(PLAN_SYNC_EVENT, onPlanSynced);
    };
  }, [refresh]);

  return session;
}

export function notifyPlanSynced(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PLAN_SYNC_EVENT));
  }
}
