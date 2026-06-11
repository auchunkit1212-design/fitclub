"use client";

import { useEffect, useMemo, useState } from "react";
import { CoachCalorieProgressBar } from "@/components/CoachCalorieProgressBar";
import { CoachMealReviewActions } from "@/components/CoachMealReviewActions";
import { MealDetailModal } from "@/components/MealDetailModal";
import { IconLabel, UtensilsCrossed } from "@/components/icons";
import { useMealRatings } from "@/hooks/use-meal-ratings";
import { mealRatingBadgeStyle, mealRatingLabel } from "@/lib/meal-rating";
import { sumLogsForDay } from "@/lib/nutrition-compliance";
import { getSessionRequestHeaders } from "@/lib/session";
import type { MealLog, RegistryUser, StudentNutritionTargets } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Period = "today" | "7d" | "30d";

const PERIOD_LABEL: Record<Period, string> = {
  today: "今日",
  "7d": "近 7 日",
  "30d": "近 30 日",
};

const DEFAULT_CALORIE_TARGET = 2000;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function filterStudentLogs(
  logs: MealLog[],
  email: string,
  period: Period
): MealLog[] {
  const normalized = email.trim().toLowerCase();
  const today = todayIsoDate();
  const from =
    period === "today" ? today : period === "7d" ? daysAgoIso(6) : daysAgoIso(29);

  return logs
    .filter((log) => {
      const day = log.date.slice(0, 10);
      return (
        log.email.trim().toLowerCase() === normalized &&
        day >= from &&
        day <= today
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

type Props = {
  student: RegistryUser;
  logs: MealLog[];
  onClose: () => void;
  onLogUpdated?: (log: MealLog) => void;
  onLogDeleted?: (id: string) => void;
  onToast?: (message: string) => void;
};

export function CoachStudentMealsModal({
  student,
  logs,
  onClose,
  onLogUpdated,
  onLogDeleted,
  onToast,
}: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [detailLog, setDetailLog] = useState<MealLog | null>(null);
  const [calorieTarget, setCalorieTarget] = useState(DEFAULT_CALORIE_TARGET);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/coach/student-targets?studentEmail=${encodeURIComponent(student.email)}`,
          { credentials: "include", headers: getSessionRequestHeaders() }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          targets: StudentNutritionTargets | null;
        };
        if (data.targets?.targetCalories && data.targets.targetCalories > 0) {
          setCalorieTarget(data.targets.targetCalories);
        }
      } catch {
        // keep default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student.email]);

  const filteredLogs = useMemo(
    () => filterStudentLogs(logs, student.email, period),
    [logs, student.email, period]
  );

  const { ratingByMealId, applyRating } = useMealRatings(
    filteredLogs.map((log) => log.id)
  );

  const periodCounts = useMemo(
    () => ({
      today: filterStudentLogs(logs, student.email, "today").length,
      "7d": filterStudentLogs(logs, student.email, "7d").length,
      "30d": filterStudentLogs(logs, student.email, "30d").length,
    }),
    [logs, student.email]
  );

  const todayCalories = useMemo(
    () => sumLogsForDay(logs, student.email).calories,
    [logs, student.email]
  );

  const toggleMeal = (id: string) => {
    setExpandedMealId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl">
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-zinc-100">
            <div className="min-w-0">
              <h3 className="font-bold text-zinc-900 truncate">{student.name}</h3>
              <p className="text-xs text-zinc-500 truncate">{student.email}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-100 ${btnClass}`}
            >
              關閉
            </button>
          </div>

          <div className="px-4 py-3 border-b border-zinc-100 space-y-3">
            <CoachCalorieProgressBar
              current={todayCalories}
              target={calorieTarget}
            />

            <div>
              <p className="text-[10px] font-semibold text-zinc-500 mb-2">
                <IconLabel icon={UtensilsCrossed} size="sm" iconClassName="text-emerald-600">
                  飲食紀錄
                </IconLabel>
              </p>
              <div className="flex gap-2">
                {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPeriod(key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${btnClass} ${
                      period === key
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-zinc-600 border-zinc-200"
                    }`}
                  >
                    {PERIOD_LABEL[key]}
                    <span className="block text-[10px] font-normal opacity-80">
                      {periodCounts[key]} 餐
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {filteredLogs.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-10">
                {PERIOD_LABEL[period]}暫無飲食紀錄
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredLogs.map((log) => {
                  const coachRating = ratingByMealId.get(log.id) ?? null;
                  const calories = Number(log.calories) || 0;
                  const protein = Number(log.protein) || 0;
                  const carbs = Number(log.carbs) || 0;
                  const fats = Number(log.fats) || 0;
                  const isExpanded = expandedMealId === log.id;

                  return (
                    <li
                      key={log.id}
                      className="border border-zinc-100 rounded-xl bg-zinc-50 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleMeal(log.id)}
                        className={`w-full text-left px-3 py-3 flex items-center justify-between gap-2 hover:bg-zinc-100/80 ${btnClass}`}
                        aria-expanded={isExpanded}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-zinc-900">
                              {log.mealType}
                            </p>
                            <span className="text-xs font-medium text-emerald-700">
                              {calories} kcal
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${mealRatingBadgeStyle(coachRating)}`}
                            >
                              {mealRatingLabel(coachRating)}
                            </span>
                          </div>
                          {!isExpanded && (
                            <p className="text-xs text-zinc-500 truncate mt-0.5">
                              {log.description}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-zinc-400 text-sm transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          aria-hidden
                        >
                          ▼
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 border-t border-zinc-100 bg-white space-y-3">
                          <div>
                            <p className="text-sm text-zinc-800 leading-relaxed">
                              {log.description}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1.5">
                              {new Date(log.date).toLocaleString("zh-HK")} · 蛋白{" "}
                              {protein}g · 碳水 {carbs}g · 脂肪 {fats}g
                            </p>
                          </div>

                          <CoachMealReviewActions
                            log={log}
                            currentRating={coachRating}
                            compact
                            onRated={applyRating}
                            onSent={(kind) =>
                              onToast?.(
                                kind === "feedback"
                                  ? "已送出評語，學員會收到 App 通知"
                                  : kind === "rating"
                                    ? "已更新評價標籤"
                                    : "已送出貼紙"
                              )
                            }
                            onError={(msg) => onToast?.(msg)}
                          />

                          <button
                            type="button"
                            onClick={() => setDetailLog(log)}
                            className={`text-xs font-semibold text-emerald-700 hover:text-emerald-900 ${btnClass}`}
                          >
                            查看詳情 / 修正營養
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {detailLog && (
        <MealDetailModal
          log={detailLog}
          studentName={student.name}
          coachReviewMode
          onClose={() => setDetailLog(null)}
          onUpdated={(updated) => {
            setDetailLog(updated);
            onLogUpdated?.(updated);
            onToast?.("飲食記錄已更新");
          }}
          onCoachFeedbackSent={() =>
            onToast?.("已送出評語，學員會收到 App 通知")
          }
          onDeleted={(id) => {
            setDetailLog(null);
            if (expandedMealId === id) setExpandedMealId(null);
            onLogDeleted?.(id);
            onToast?.("已刪除學員飲食記錄");
          }}
        />
      )}
    </>
  );
}
