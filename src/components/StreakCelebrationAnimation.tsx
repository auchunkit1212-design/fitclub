"use client";

import { useEffect, useMemo, useState } from "react";
import { APP_LOGO_PATH } from "@/lib/brand";
import { Flame, Sparkles, ThumbsUp } from "@/components/icons";

type Props = {
  days: number;
  isSpecialMilestone?: boolean;
  /** Auto-hide intro after ms; 0 = stay visible */
  autoFinishMs?: number;
  onFinished?: () => void;
  className?: string;
};

const CONFETTI_COLORS = [
  "#059669",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#f472b6",
  "#38bdf8",
  "#a78bfa",
];

export function StreakCelebrationAnimation({
  days,
  isSpecialMilestone = false,
  autoFinishMs = 2800,
  onFinished,
  className = "",
}: Props) {
  const [phase, setPhase] = useState<"burst" | "hold" | "done">("burst");

  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${4 + ((i * 17) % 92)}%`,
        delay: `${(i % 10) * 0.08}s`,
        duration: `${1.4 + (i % 5) * 0.18}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: `${(i * 47) % 360}deg`,
        size: 6 + (i % 5) * 2,
      })),
    []
  );

  useEffect(() => {
    const holdTimer = window.setTimeout(() => setPhase("hold"), 700);
    let finishTimer: number | undefined;
    if (autoFinishMs > 0) {
      finishTimer = window.setTimeout(() => {
        setPhase("done");
        onFinished?.();
      }, autoFinishMs);
    }
    return () => {
      window.clearTimeout(holdTimer);
      if (finishTimer) window.clearTimeout(finishTimer);
    };
    // intentionally omit onFinished from deps — parent may pass inline fn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFinishMs]);

  if (phase === "done" && autoFinishMs > 0) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl ${className}`}
      aria-hidden
    >
      <div
        className={`absolute inset-0 ${
          isSpecialMilestone
            ? "bg-gradient-to-b from-amber-100 via-orange-50 to-emerald-50"
            : "bg-gradient-to-b from-emerald-100 via-white to-teal-50"
        }`}
      />

      {/* Burst glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-52 h-52 rounded-full bg-emerald-300/45 blur-3xl animate-streak-glow" />
        {isSpecialMilestone ? (
          <div className="absolute w-60 h-60 rounded-full bg-amber-300/35 blur-3xl animate-streak-glow-delayed" />
        ) : null}
      </div>

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((piece) => (
          <span
            key={piece.id}
            className="absolute top-[-12px] rounded-sm animate-streak-confetti"
            style={{
              left: piece.left,
              width: piece.size,
              height: piece.size * 0.55,
              backgroundColor: piece.color,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              transform: `rotate(${piece.rotate})`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center py-10 px-4 min-h-[320px]">
        <div className="relative mb-1">
          <div className="absolute -inset-6 rounded-full border-2 border-dashed border-orange-300/70 animate-streak-orbit" />
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 animate-streak-flame">
            <Flame
              size={28}
              className="text-orange-500 fill-orange-400 drop-shadow"
              aria-hidden
            />
          </div>
          <div className="absolute -bottom-1 -right-3 animate-streak-flame-delayed">
            <Sparkles size={18} className="text-amber-500" aria-hidden />
          </div>
          <div className="absolute -bottom-1 -left-3 animate-streak-flame">
            <Sparkles size={16} className="text-emerald-500" aria-hidden />
          </div>

          {/* Gorilla */}
          <div className="relative w-40 h-40 rounded-full bg-white shadow-[0_12px_40px_rgb(5,150,105,0.25)] ring-4 ring-emerald-200/80 overflow-hidden flex items-center justify-center animate-streak-gorilla">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={APP_LOGO_PATH}
              alt=""
              className="w-[90%] h-[90%] object-contain"
            />
          </div>

          {/* Big GOOD thumbs-up badge */}
          <div className="absolute -right-3 top-2 z-20 animate-streak-good">
            <div
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 shadow-[0_10px_28px_rgb(0,0,0,0.18)] ring-2 ring-white ${
                isSpecialMilestone
                  ? "bg-gradient-to-br from-amber-400 to-orange-500"
                  : "bg-gradient-to-br from-emerald-500 to-teal-600"
              }`}
            >
              <ThumbsUp
                size={22}
                className="text-white fill-white"
                aria-hidden
              />
              <span className="text-lg font-black tracking-wide text-white leading-none">
                GOOD
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 text-center space-y-1.5 animate-streak-pop">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
            {isSpecialMilestone ? "MILESTONE" : "STREAK"}
          </p>
          <p className="text-7xl sm:text-8xl font-black tabular-nums text-zinc-900 leading-none tracking-tight">
            {days}
            <span className="ml-1.5 text-3xl sm:text-4xl font-black text-orange-500 align-middle">
              日
            </span>
          </p>
          <p className="pt-1 text-base font-bold text-zinc-700">
            {isSpecialMilestone
              ? "大猩猩俾你個 GOOD！里程碑達成"
              : "大猩猩俾你個 GOOD！"}
          </p>
        </div>
      </div>
    </div>
  );
}
