"use client";

type Props = {
  current: number;
  target: number;
  className?: string;
};

function barColorClass(pct: number): string {
  if (pct > 110) return "bg-red-500";
  if (pct > 100) return "bg-amber-500";
  return "bg-emerald-500";
}

export function CoachCalorieProgressBar({
  current,
  target,
  className = "",
}: Props) {
  const safeTarget = Math.max(target, 1);
  const pct = Math.round((current / safeTarget) * 100);
  const widthPct = Math.min(100, pct);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <p className="text-xs font-medium text-zinc-700">
        今日總熱量：{Math.round(current)} / {Math.round(target)} kcal
        <span className="text-zinc-400 font-normal ml-1">({pct}%)</span>
      </p>
      <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColorClass(pct)}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}
