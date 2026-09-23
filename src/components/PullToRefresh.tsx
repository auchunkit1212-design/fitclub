"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";

const PULL_THRESHOLD = 72;
const MAX_PULL = 112;
/** Finger must move down this far before we hijack the gesture (lets normal scroll win). */
const PULL_ACTIVATE_PX = 14;

type PullToRefreshProps = {
  children: ReactNode;
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
};

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

function scrollTop(): number {
  if (typeof window === "undefined") return 0;
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

function isAtTop(): boolean {
  return scrollTop() <= 2;
}

export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
}: PullToRefreshProps) {
  const { t } = useI18n();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  /** Touch sequence is being tracked (started at top). */
  const tracking = useRef(false);
  /** Pull-to-refresh actively owns the gesture (past activation threshold). */
  const pulling = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const ptrDisabled = disabled || isAndroid();

  onRefreshRef.current = onRefresh;

  const resetGesture = useCallback(() => {
    tracking.current = false;
    pulling.current = false;
    setPull(0);
  }, []);

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (ptrDisabled || refreshing) return;
      if (!isAtTop()) return;
      if (event.touches.length !== 1) return;

      startY.current = event.touches[0]?.clientY ?? 0;
      tracking.current = true;
      pulling.current = false;
    },
    [ptrDisabled, refreshing]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!tracking.current || ptrDisabled || refreshing) return;
      if (event.touches.length !== 1) {
        resetGesture();
        return;
      }

      const touchY = event.touches[0]?.clientY ?? 0;
      const delta = touchY - startY.current;

      // Finger moving up → user wants to scroll down the page; never block.
      if (delta < 0) {
        pulling.current = false;
        setPull(0);
        return;
      }

      if (!isAtTop()) {
        resetGesture();
        return;
      }

      // Below activation threshold: let the browser handle scroll / overscroll.
      if (!pulling.current && delta < PULL_ACTIVATE_PX) {
        return;
      }

      pulling.current = true;
      event.preventDefault();
      setPull(Math.min(delta * 0.45, MAX_PULL));
    },
    [ptrDisabled, refreshing, resetGesture]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!tracking.current) return;

    const shouldRefresh =
      pulling.current && pull >= PULL_THRESHOLD && !ptrDisabled && !refreshing;

    tracking.current = false;
    pulling.current = false;

    if (!shouldRefresh) {
      setPull(0);
      return;
    }

    setRefreshing(true);
    setPull(PULL_THRESHOLD);
    try {
      await onRefreshRef.current();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [pull, ptrDisabled, refreshing]);

  useEffect(() => {
    if (ptrDisabled) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, ptrDisabled]);

  const visible = !ptrDisabled && (pull > 8 || refreshing);
  const ready = pull >= PULL_THRESHOLD && !refreshing;

  const label = refreshing
    ? t("pullRefresh.refreshing", "刷新緊...")
    : ready
      ? t("pullRefresh.release", "放手刷新")
      : t("pullRefresh.pull", "轆低刷新");

  return (
    <>
      <div
        aria-hidden={!visible}
        className={`fixed left-0 right-0 z-[60] flex justify-center pointer-events-none transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          top: "max(0.5rem, env(safe-area-inset-top))",
          transform: `translateY(${refreshing ? PULL_THRESHOLD * 0.35 : pull * 0.35}px)`,
        }}
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-white/95 border border-zinc-200 shadow-md px-3 py-1.5 text-xs font-semibold text-zinc-700">
          <Loader2
            size={16}
            strokeWidth={2.25}
            className={refreshing ? "animate-spin text-emerald-600" : "text-zinc-400"}
            aria-hidden
          />
          <span>{label}</span>
        </div>
      </div>
      {children}
    </>
  );
}
