"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { estimateMicronutrients } from "@/lib/body-profile";
import { groupLogsByBucket, MEAL_BUCKET_LABELS } from "@/lib/meal-buckets";
import type { MealLog } from "@/lib/types";

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7"];
const MACRO_COLORS = ["#f59e0b", "#ef4444", "#6366f1"];

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface NutritionDashboardProps {
  logs: MealLog[];
  goalCalories: number;
  exerciseCalories: number;
  onClose: () => void;
  onExerciseChange?: (kcal: number) => void;
}

function MicroBar({
  label,
  current,
  target,
  unit,
  color,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min(100, Math.round((current / target) * 100)) || 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500">
          {current}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function NutritionDashboard({
  logs,
  goalCalories,
  exerciseCalories,
  onClose,
  onExerciseChange,
}: NutritionDashboardProps) {
  const [exerciseInput, setExerciseInput] = useState(String(exerciseCalories));

  const totals = useMemo(() => {
    return logs.reduce(
      (acc, log) => ({
        calories: acc.calories + log.calories,
        protein: acc.protein + log.protein,
        carbs: acc.carbs + log.carbs,
        fats: acc.fats + log.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [logs]);

  const exercise = Number(exerciseInput) || 0;
  const remaining = goalCalories - totals.calories + exercise;

  const buckets = useMemo(() => groupLogsByBucket(logs), [logs]);

  const mealPieData = useMemo(() => {
    return (Object.keys(buckets) as Array<keyof typeof buckets>)
      .map((key) => {
        const items = buckets[key];
        const cal = items.reduce((s, l) => s + l.calories, 0);
        return {
          name: MEAL_BUCKET_LABELS[key],
          value: cal,
        };
      })
      .filter((d) => d.value > 0);
  }, [buckets]);

  const macroPieData = useMemo(
    () => [
      { name: "碳水", value: totals.carbs * 4 },
      { name: "蛋白質", value: totals.protein * 4 },
      { name: "脂肪", value: totals.fats * 9 },
    ].filter((d) => d.value > 0),
    [totals]
  );

  const micro = estimateMicronutrients(
    totals.calories,
    totals.carbs,
    totals.fats,
    totals.protein
  );

  return (
    <div className="fixed inset-0 z-[90] bg-zinc-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-zinc-50 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-200 bg-white rounded-t-3xl shrink-0">
          <div>
            <p className="text-xs text-violet-600 font-semibold">殿堂級</p>
            <h2 className="text-lg font-bold text-zinc-900">高級營養分析</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 font-bold ${btnClass}`}
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4 pb-safe">
          <section className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-2xl p-4 shadow-lg">
            <p className="text-violet-200 text-xs font-medium mb-3">
              每日熱量動態扣減
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-white/10 rounded-xl py-2">
                <p className="text-white/70 text-[10px]">目標 Goal</p>
                <p className="font-bold text-lg">{goalCalories}</p>
              </div>
              <div className="bg-white/10 rounded-xl py-2">
                <p className="text-white/70 text-[10px]">已攝取 Food</p>
                <p className="font-bold text-lg">{totals.calories}</p>
              </div>
              <div className="bg-white/10 rounded-xl py-2">
                <p className="text-white/70 text-[10px]">運動 Exercise</p>
                <p className="font-bold text-lg">+{exercise}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20 text-center">
              <p className="text-white/80 text-xs">剩餘熱量 Remaining</p>
              <p
                className={`text-3xl font-black mt-1 ${
                  remaining < 0 ? "text-amber-300" : "text-white"
                }`}
              >
                {remaining} kcal
              </p>
              <p className="text-[10px] text-white/60 mt-1 font-mono">
                {goalCalories} − {totals.calories} + {exercise} = {remaining}
              </p>
            </div>
            {onExerciseChange && (
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={exerciseInput}
                  onChange={(e) => setExerciseInput(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-zinc-900 text-sm"
                  placeholder="運動消耗"
                />
                <button
                  type="button"
                  onClick={() => onExerciseChange(Number(exerciseInput) || 0)}
                  className={`px-4 py-2 bg-white text-violet-700 font-semibold rounded-lg text-sm ${btnClass}`}
                >
                  更新
                </button>
              </div>
            )}
          </section>

          {(Object.keys(buckets) as Array<keyof typeof buckets>).map((key) => (
            <section
              key={key}
              className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm"
            >
              <h3 className="font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {MEAL_BUCKET_LABELS[key]}
                <span className="text-xs font-normal text-zinc-400 ml-auto">
                  {buckets[key].reduce((s, l) => s + l.calories, 0)} kcal
                </span>
              </h3>
              {buckets[key].length === 0 ? (
                <p className="text-sm text-zinc-400 py-2">暫無記錄</p>
              ) : (
                <ul className="space-y-2">
                  {buckets[key].map((log) => (
                    <li
                      key={log.id}
                      className="flex justify-between gap-2 text-sm p-2 rounded-xl bg-zinc-50"
                    >
                      <span className="truncate text-zinc-800">
                        {log.mealType} · {log.description}
                      </span>
                      <span className="shrink-0 font-medium text-zinc-600">
                        {log.calories} kcal
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
            <h3 className="font-semibold text-zinc-800 mb-3">圖表分析</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500 text-center mb-2">
                  每餐卡路里佔比
                </p>
                {mealPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={mealPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {mealPieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} kcal`, "熱量"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-zinc-400 text-center py-8">
                    今日未有飲食記錄
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-zinc-500 text-center mb-2">
                  三大營養素黃金比例
                </p>
                {macroPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={macroPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                      >
                        {macroPieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={MACRO_COLORS[i % MACRO_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} kcal`, "能量"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-zinc-400 text-center py-8">
                    未有營養素數據
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-zinc-800">微量元素 Micronutrients</h3>
            <MicroBar
              label="膳食纖維"
              current={micro.fiberG}
              target={28}
              unit="g"
              color="bg-emerald-500"
            />
            <MicroBar
              label="糖分"
              current={micro.sugarG}
              target={50}
              unit="g"
              color="bg-amber-500"
            />
            <MicroBar
              label="飽和脂肪"
              current={micro.satFatG}
              target={20}
              unit="g"
              color="bg-red-500"
            />
            <MicroBar
              label="鈉"
              current={micro.sodiumMg}
              target={2300}
              unit="mg"
              color="bg-blue-500"
            />
            <p className="text-[10px] text-zinc-400">
              * 微量元素由今日總攝取估算，僅供參考
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
