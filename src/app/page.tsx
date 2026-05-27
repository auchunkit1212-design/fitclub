"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateRoast } from "@/lib/ai-mock";
import {
  getCoachBranding,
  getCoachBroadcast,
  getMealLogs,
  getThemeClasses,
  getUserProfile,
  isToday,
} from "@/lib/storage";
import type { CoachBranding, MealLog, UserProfile } from "@/lib/types";

const MOCK_WEIGHTS = [72.4, 72.1, 71.9, 71.6, 71.4, 71.2, 71.0];

function WeightTrendChart() {
  const min = Math.min(...MOCK_WEIGHTS) - 0.5;
  const max = Math.max(...MOCK_WEIGHTS) + 0.5;
  const range = max - min || 1;
  const w = 280;
  const h = 80;
  const pad = 8;

  const points = MOCK_WEIGHTS.map((weight, i) => {
    const x = pad + (i / (MOCK_WEIGHTS.length - 1)) * (w - pad * 2);
    const y = h - pad - ((weight - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="text-emerald-500"
      />
      {MOCK_WEIGHTS.map((weight, i) => {
        const x = pad + (i / (MOCK_WEIGHTS.length - 1)) * (w - pad * 2);
        const y = h - pad - ((weight - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="3" className="fill-emerald-500" />;
      })}
    </svg>
  );
}

function ProgressBar({
  label,
  current,
  target,
  unit,
  barClass,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  barClass: string;
}) {
  const pct = Math.min(100, Math.round((current / target) * 100)) || 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500">
          {current}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-3 rounded-full bg-zinc-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [branding, setBranding] = useState<CoachBranding | null>(null);
  const [broadcast, setBroadcast] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);

  useEffect(() => {
    setProfile(getUserProfile());
    setBranding(getCoachBranding());
    setBroadcast(getCoachBroadcast());
    setLogs(getMealLogs());
  }, []);

  const todayLogs = useMemo(
    () => logs.filter((l) => isToday(l.date)),
    [logs]
  );

  const todayCalories = todayLogs.reduce((s, l) => s + l.calories, 0);
  const todayProtein = todayLogs.reduce((s, l) => s + l.protein, 0);

  const targetCalories = profile?.targetCalories ?? 2000;
  const targetProtein = profile?.targetProtein ?? 120;

  const roast = generateRoast(
    todayCalories,
    targetCalories,
    todayProtein,
    targetProtein
  );

  const theme = getThemeClasses(branding?.themeColor ?? "emerald");
  const title = branding?.appTitle ?? "健身飲食追蹤";

  if (!profile || !branding) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        載入緊...
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto">
      <header className={`${theme.header} text-white px-4 pt-10 pb-6 rounded-b-3xl shadow-lg`}>
        <p className="text-white/80 text-sm">學員主頁</p>
        <h1 className="text-2xl font-bold mt-1">{title}</h1>
        <p className="text-white/90 text-sm mt-2">
          今日已記錄 {todayLogs.length} 餐
        </p>
      </header>

      <main className="px-4 -mt-4 space-y-4">
        {broadcast.trim() && (
          <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-md animate-pulse text-sm font-medium">
            📣 教練突發警告: {broadcast}
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
          <h2 className={`text-sm font-semibold ${theme.accent} mb-2`}>
            🤖 AI 教練吐槽
          </h2>
          <p className="text-zinc-800 leading-relaxed">{roast}</p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4 space-y-4">
          <h2 className="font-semibold text-zinc-800">今日進度</h2>
          <ProgressBar
            label="熱量"
            current={todayCalories}
            target={targetCalories}
            unit=""
            barClass={theme.bar}
          />
          <ProgressBar
            label="蛋白質"
            current={todayProtein}
            target={targetProtein}
            unit="g"
            barClass={theme.bar}
          />
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-zinc-800">體重趨勢（模擬）</h2>
            <span className="text-xs text-zinc-400">過去 7 日</span>
          </div>
          <WeightTrendChart />
          <p className="text-xs text-zinc-400 mt-2 text-center">
            最新: {MOCK_WEIGHTS[MOCK_WEIGHTS.length - 1]} kg
          </p>
        </section>

        {todayLogs.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
            <h2 className="font-semibold text-zinc-800 mb-3">今日餐單</h2>
            <ul className="space-y-2">
              {todayLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex gap-3 p-2 rounded-xl bg-zinc-50 border border-zinc-100"
                >
                  {log.imageBase64 && (
                    <img
                      src={log.imageBase64}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {log.mealType} · {log.description}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {log.calories} kcal · 蛋白 {log.protein}g
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-zinc-200 px-4 py-4 pb-safe">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push("/add-meal")}
            className={`${theme.btn} text-white font-semibold py-4 rounded-2xl shadow-md active:scale-95 active:opacity-80 transition-all cursor-pointer`}
          >
            ➕ 記錄飲食
          </button>
          <button
            type="button"
            onClick={() => router.push("/coach")}
            className="bg-zinc-800 text-white font-semibold py-4 rounded-2xl shadow-md active:scale-95 active:opacity-80 transition-all cursor-pointer"
          >
            👨‍🏫 教練後台
          </button>
        </div>
      </nav>
    </div>
  );
}
