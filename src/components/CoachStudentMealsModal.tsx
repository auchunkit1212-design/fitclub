"use client";

import { useMemo, useState } from "react";
import { CoachMealReviewActions } from "@/components/CoachMealReviewActions";
import { MealDetailModal } from "@/components/MealDetailModal";
import { IconLabel, UtensilsCrossed } from "@/components/icons";
import { getMealStatus, mealStatusStyles } from "@/lib/meal-status";
import type { MealLog, RegistryUser } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Period = "today" | "7d" | "30d";

const PERIOD_LABEL: Record<Period, string> = {
  today: "今日",
  "7d": "近 7 日",
  "30d": "近 30 日",
};

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
  onToast?: (message: string) => void;
};

export function CoachStudentMealsModal({
  student,
  logs,
  onClose,
  onLogUpdated,
  onToast,
}: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [selectedLog, setSelectedLog] = useState<MealLog | null>(null);

  const filteredLogs = useMemo(
    () => filterStudentLogs(logs, student.email, period),
    [logs, student.email, period]
  );

  const periodCounts = useMemo(
    () => ({
      today: filterStudentLogs(logs, student.email, "today").length,
      "7d": filterStudentLogs(logs, student.email, "7d").length,
      "30d": filterStudentLogs(logs, student.email, "30d").length,
    }),
    [logs, student.email]
  );

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

          <div className="px-4 py-3 border-b border-zinc-100">
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

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {filteredLogs.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-10">
                {PERIOD_LABEL[period]}暫無飲食紀錄
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredLogs.map((log) => {
                  const status = getMealStatus(log);
                  const calories = Number(log.calories) || 0;
                  const protein = Number(log.protein) || 0;
                  const carbs = Number(log.carbs) || 0;
                  const fats = Number(log.fats) || 0;
                  return (
                    <li
                      key={log.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedLog(log)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedLog(log)}
                      className={`border border-zinc-100 rounded-xl p-3 bg-zinc-50 cursor-pointer hover:bg-zinc-100/80 ${btnClass}`}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{log.mealType}</p>
                          <p className="text-sm text-zinc-700 truncate">
                            {log.description}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {new Date(log.date).toLocaleString("zh-HK")} ·{" "}
                            {calories} kcal · 蛋白 {protein}g · 碳水 {carbs}g · 脂肪{" "}
                            {fats}g
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold h-fit ${mealStatusStyles(status)}`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <CoachMealReviewActions
                          log={log}
                          compact
                          onSent={(kind) =>
                            onToast?.(
                              kind === "feedback"
                                ? "已送出評語，學員會收到 App 通知"
                                : "已送出貼紙"
                            )
                          }
                          onError={(msg) => onToast?.(msg)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {selectedLog && (
        <MealDetailModal
          log={selectedLog}
          studentName={student.name}
          coachReviewMode
          onClose={() => setSelectedLog(null)}
          onUpdated={(updated) => {
            setSelectedLog(updated);
            onLogUpdated?.(updated);
            onToast?.("飲食記錄已更新");
          }}
          onCoachFeedbackSent={() =>
            onToast?.("已送出評語，學員會收到 App 通知")
          }
        />
      )}
    </>
  );
}
