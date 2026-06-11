"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, IconLabel, Plus } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { getMealAiComment } from "@/lib/ai-mock";
import type { MealLog } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface CoachSelfMealPanelProps {
  logs: MealLog[];
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function CoachSelfMealPanel({ logs }: CoachSelfMealPanelProps) {
  const { t } = useI18n();
  const [fromDate, setFromDate] = useState(daysAgoIso(7));
  const [toDate, setToDate] = useState(todayIsoDate());

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const day = log.date.slice(0, 10);
      return day >= fromDate && day <= toDate;
    });
  }, [logs, fromDate, toDate]);

  return (
    <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-800">
          {t("coach.myMeals", "我的飲食記錄")} ({filteredLogs.length})
        </h2>
        <Link
          href="/add-meal?from=coach"
          className={`shrink-0 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold ${btnClass}`}
        >
          <IconLabel icon={Plus} size="sm" iconClassName="text-white">
            {t("coach.logMeal", "記錄飲食")}
          </IconLabel>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500">
            {t("coach.fromDate", "開始日期")}
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">
            {t("coach.toDate", "結束日期")}
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-6">
          {t("coach.noMealsInRange", "此篩選條件下暫無記錄。")}
        </p>
      ) : (
        <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {filteredLogs.map((log) => {
            return (
              <li
                key={log.id}
                className="border border-zinc-100 rounded-xl p-3 bg-zinc-50"
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{log.mealType}</p>
                    <p className="text-sm text-zinc-700 mt-0.5 truncate">
                      {log.description}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(log.date).toLocaleString("zh-HK")} · {log.calories}{" "}
                      kcal · {t("coach.proteinG", "蛋白")} {log.protein}g
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-indigo-800 bg-indigo-50 rounded-lg px-2 py-1.5 leading-relaxed">
                  <IconLabel icon={Bot} size="sm" iconClassName="text-indigo-700" gapClass="gap-1.5">
                    {getMealAiComment(log)}
                  </IconLabel>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
