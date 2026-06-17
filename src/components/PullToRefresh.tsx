"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";

const PULL_THRESHOLD = 72;
const MAX_PULL = 112;

type PullToRefreshProps = {
  children: ReactNode;
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
};

export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
}: PullToRefreshProps) {
  const { t } = useI18n();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  onRefreshRef.current = onRefresh;

  const isAtTop = () =>
    typeof window !== "undefined" && window.scrollY <= 2;

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (disabled || refreshing) return;
      if (!isAtTop()) return;
      startY.current = event.touches[0]?.clientY ?? 0;
      pulling.current = true;
    },
    [disabled, refreshing]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!pulling.current || disabled || refreshing) return;

      const touchY = event.touches[0]?.clientY ?? 0;
      const delta = touchY - startY.current;

      if (delta <= 0) {
        setPull(0);
        return;
      }

      if (!isAtTop()) {
        pulling.current = false;
        setPull(0);
        return;
      }

      event.preventDefault();
      setPull(Math.min(delta * 0.45, MAX_PULL));
    },
    [disabled, refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    const shouldRefresh = pull >= PULL_THRESHOLD && !disabled && !refreshing;
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
  }, [pull, disabled, refreshing]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const visible = pull > 8 || refreshing;
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
