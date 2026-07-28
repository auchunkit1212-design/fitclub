"use client";

import { useEffect, useMemo, useState } from "react";
import { APP_LOGO_PATH } from "@/lib/brand";
import { Flame, Sparkles } from "@/components/icons";

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
        <div className="w-48 h-48 rounded-full bg-emerald-300/40 blur-3xl animate-streak-glow" />
        {isSpecialMilestone ? (
          <div className="absolute w-56 h-56 rounded-full bg-amber-300/30 blur-3xl animate-streak-glow-delayed" />
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

      <div className="relative z-10 flex flex-col items-center justify-center py-8 px-4 min-h-[280px]">
        {/* Flame orbit */}
        <div className="relative mb-2">
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

          <div className="relative w-36 h-36 rounded-full bg-white shadow-[0_12px_40px_rgb(5,150,105,0.25)] ring-4 ring-emerald-200/80 overflow-hidden flex items-center justify-center animate-streak-gorilla">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={APP_LOGO_PATH}
              alt=""
              className="w-[88%] h-[88%] object-contain"
            />
          </div>
        </div>

        <div className="mt-4 text-center space-y-1 animate-streak-pop">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
            {isSpecialMilestone ? "MILESTONE" : "STREAK"}
          </p>
          <p className="text-5xl font-black tabular-nums text-zinc-900 leading-none">
            {days}
            <span className="ml-1 text-2xl font-bold text-orange-500">日</span>
          </p>
          <p className="text-sm font-semibold text-zinc-600">
            {isSpecialMilestone
              ? "大猩猩為你打氣！里程碑達成"
              : "大猩猩慶祝你連續打卡"}
          </p>
        </div>
      </div>
    </div>
  );
}
