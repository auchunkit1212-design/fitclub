"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { zhHK, zhTW, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { HistoryDayDetailPanel } from "@/components/HistoryDayDetail";
import type {
  HistoryDayDetail,
  HistoryDaySummary,
  ResolvedNutritionTargets,
} from "@/lib/history-calendar";

const SOFT_CARD =
  "rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type MonthPayload = {
  year: number;
  month: number;
  targets: ResolvedNutritionTargets;
  days: HistoryDaySummary[];
};

function localeForTag(tag: string) {
  if (tag.startsWith("zh-TW")) return zhTW;
  if (tag.startsWith("zh")) return zhHK;
  return enUS;
}

export function HistoryCalendar({ embedded = false }: { embedded?: boolean }) {
  const { t, lang } = useI18n();
  const dateLocale = localeForTag(lang);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [monthData, setMonthData] = useState<MonthPayload | null>(null);
  const [monthLoading, setMonthLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<HistoryDayDetail | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const loadMonth = useCallback(async () => {
    setMonthLoading(true);
    try {
      const res = await fetch(
        `/api/history/month?year=${year}&month=${month}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("month fetch failed");
      const data = (await res.json()) as MonthPayload;
      setMonthData(data);
    } catch {
      setMonthData(null);
    } finally {
      setMonthLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const loadDay = useCallback(async (date: string) => {
    setDayLoading(true);
    setDayDetail(null);
    try {
      const res = await fetch(`/api/history/day?date=${date}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("day fetch failed");
      const data = (await res.json()) as HistoryDayDetail;
      setDayDetail(data);
    } catch {
      setDayDetail(null);
    } finally {
      setDayLoading(false);
    }
  }, []);

  const handleSelectDay = (date: Date) => {
    if (!isSameMonth(date, viewDate)) return;
    const key = format(date, "yyyy-MM-dd");
    setSelectedDate(key);
    void loadDay(key);
  };

  const dayMap = useMemo(() => {
    const map = new Map<string, HistoryDaySummary>();
    monthData?.days.forEach((d) => map.set(d.date, d));
    return map;
  }, [monthData]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const weekLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return format(d, "EEEEE", { locale: dateLocale });
    });
  }, [dateLocale]);

  const monthTitle = format(viewDate, "yyyy MMMM", { locale: dateLocale });

  return (
    <div className={embedded ? "space-y-5" : "space-y-6"}>
      <div className={`${SOFT_CARD} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            type="button"
            onClick={() => setViewDate((d) => subMonths(d, 1))}
            className={`p-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 ${btnClass}`}
            aria-label={t("history.prevMonth", "上個月")}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {monthTitle}
            </h2>
            {monthData && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {t("history.targetHint", "目標 {calories} kcal/日", {
                  calories: monthData.targets.targetCalories,
                })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className={`p-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 ${btnClass}`}
            aria-label={t("history.nextMonth", "下個月")}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekLabels.map((label) => (
            <div
              key={label}
              className="text-center text-[10px] font-semibold text-gray-400 py-1"
            >
              {label}
            </div>
          ))}
        </div>

        {monthLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {t("history.loading", "載入日曆…")}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, viewDate);
              const summary = dayMap.get(key);
              const isSelected =
                selectedDate !== null && isSameDay(day, new Date(selectedDate));
              const isToday = isSameDay(day, new Date());

              let dotClass = "";
              if (inMonth && summary?.status === "under") {
                dotClass = "bg-green-500";
              } else if (inMonth && summary?.status === "over") {
                dotClass = "bg-red-500";
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!inMonth}
                  onClick={() => handleSelectDay(day)}
                  className={`
                    flex flex-col items-center justify-center gap-0.5
                    aspect-square rounded-2xl text-sm transition-all
                    ${inMonth ? `${btnClass} hover:bg-gray-50` : "opacity-30 cursor-default"}
                    ${isSelected ? "bg-emerald-50 ring-2 ring-emerald-500/40" : ""}
                    ${isToday && inMonth && !isSelected ? "font-bold text-emerald-600" : ""}
                  `}
                >
                  <span
                    className={`tabular-nums ${
                      inMonth ? "text-gray-800" : "text-gray-300"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {dotClass ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${dotClass}`}
                      aria-hidden
                    />
                  ) : (
                    <span className="w-1.5 h-1.5" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mt-5 pt-4 border-t border-gray-50">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {t("history.legend.under", "達標")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {t("history.legend.over", "超標")}
          </span>
        </div>
      </div>

      <HistoryDayDetailPanel detail={dayDetail} loading={dayLoading} />
    </div>
  );
}
