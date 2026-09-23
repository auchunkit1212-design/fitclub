"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { getSessionRequestHeaders } from "@/lib/session";
import { fetchWithTimeout } from "@/lib/with-timeout";
import { HistoryDayDetailPanel } from "@/components/HistoryDayDetail";
import { LoadingView } from "@/components/LoadingView";
import { MealDetailModal } from "@/components/MealDetailModal";
import type {
  HistoryDayDetail,
  HistoryDaySummary,
  HistoryMonthStats,
  ResolvedNutritionTargets,
} from "@/lib/history-calendar";
import type { ComplianceLevel } from "@/lib/nutrition-compliance";
import type { MealLog } from "@/lib/types";

const SOFT_CARD =
  "rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type MonthPayload = {
  year: number;
  month: number;
  targets: ResolvedNutritionTargets;
  days: HistoryDaySummary[];
  stats?: HistoryMonthStats;
};

function dotClassForStatus(status: ComplianceLevel | undefined): string {
  switch (status) {
    case "met":
      return "bg-emerald-500";
    case "partial":
      return "bg-amber-400";
    case "low":
      return "bg-orange-500";
    case "over":
      return "bg-red-500";
    default:
      return "";
  }
}

function localeForTag(tag: string) {
  if (tag.startsWith("zh-TW")) return zhTW;
  if (tag.startsWith("zh")) return zhHK;
  return enUS;
}

function historyStudentQuery(studentEmail?: string): string {
  if (!studentEmail?.trim()) return "";
  return `&studentEmail=${encodeURIComponent(studentEmail.trim().toLowerCase())}`;
}

export function HistoryCalendar({
  embedded = false,
  studentEmail,
  onSelectedDateChange,
}: {
  embedded?: boolean;
  /** When set (coach view), loads that student's nutrition history. */
  studentEmail?: string;
  /** Notifies parent when the selected calendar day changes (for FAB backfill). */
  onSelectedDateChange?: (date: string | null) => void;
}) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const dateLocale = localeForTag(lang);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [monthData, setMonthData] = useState<MonthPayload | null>(null);
  const [monthLoading, setMonthLoading] = useState(true);
  const [monthError, setMonthError] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<HistoryDayDetail | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [selectedMealLog, setSelectedMealLog] = useState<MealLog | null>(null);

  const canBackfill = !studentEmail;

  const goAddMealForDate = useCallback(
    (date: string) => {
      router.push(`/add-meal?date=${encodeURIComponent(date)}`);
    },
    [router]
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const loadMonth = useCallback(async () => {
    setMonthLoading(true);
    setMonthError(false);
    try {
      const res = await fetchWithTimeout(
        `/api/history/month?year=${year}&month=${month}${historyStudentQuery(studentEmail)}`,
        { credentials: "include", headers: getSessionRequestHeaders() }
      );
      if (!res.ok) throw new Error("month fetch failed");
      const data = (await res.json()) as MonthPayload;
      setMonthData(data);
    } catch {
      setMonthData(null);
      setMonthError(true);
    } finally {
      setMonthLoading(false);
    }
  }, [year, month, studentEmail]);

  useEffect(() => {
    setSelectedDate(null);
    setDayDetail(null);
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    onSelectedDateChange?.(selectedDate);
  }, [selectedDate, onSelectedDateChange]);

  const loadDay = useCallback(async (date: string) => {
    setDayLoading(true);
    setDayDetail(null);
    try {
      const res = await fetchWithTimeout(
        `/api/history/day?date=${date}${historyStudentQuery(studentEmail)}`,
        {
          credentials: "include",
          headers: getSessionRequestHeaders(),
        }
      );
      if (!res.ok) throw new Error("day fetch failed");
      const data = (await res.json()) as HistoryDayDetail;
      setDayDetail(data);
    } catch {
      setDayDetail(null);
    } finally {
      setDayLoading(false);
    }
  }, [studentEmail]);

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
                {monthData.stats
                  ? t(
                      "history.monthStats",
                      "本月 {met}/{logged} 天達標 · 目標 {calories} kcal/日",
                      {
                        met: monthData.stats.met,
                        logged: monthData.stats.logged,
                        calories: monthData.targets.targetCalories,
                      }
                    )
                  : t("history.targetHint", "目標 {calories} kcal/日", {
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
          <LoadingView
            variant="section"
            message={t("history.loading", "載入日曆…")}
          />
        ) : monthError ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-gray-500">
              {t("history.loadFailed", "日曆載入失敗，請檢查網絡後重試")}
            </p>
            <button
              type="button"
              onClick={() => void loadMonth()}
              className={`text-xs font-semibold text-emerald-700 px-3 py-1.5 rounded-lg bg-emerald-50 ${btnClass}`}
            >
              {t("common.retry", "重試")}
            </button>
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

              const dotClass =
                inMonth && summary && summary.status !== "none"
                  ? dotClassForStatus(summary.status)
                  : "";

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

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-5 pt-4 border-t border-gray-50">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {t("history.legend.met", "達標")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {t("history.legend.partial", "注意")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            {t("history.legend.low", "未達")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {t("history.legend.over", "超標")}
          </span>
        </div>
      </div>

      <HistoryDayDetailPanel
        detail={dayDetail}
        loading={dayLoading}
        onSelectMeal={setSelectedMealLog}
        onAddMealForDate={canBackfill ? goAddMealForDate : undefined}
      />

      {selectedMealLog && (
        <MealDetailModal
          log={selectedMealLog}
          onClose={() => setSelectedMealLog(null)}
          onUpdated={(updated) => {
            setSelectedMealLog(updated);
            setDayDetail((prev) =>
              prev
                ? {
                    ...prev,
                    meals: prev.meals.map((m) =>
                      m.id === updated.id ? updated : m
                    ),
                  }
                : prev
            );
            void loadMonth();
          }}
          onDeleted={(id) => {
            setSelectedMealLog(null);
            setDayDetail((prev) =>
              prev
                ? {
                    ...prev,
                    meals: prev.meals.filter((m) => m.id !== id),
                  }
                : prev
            );
            void loadMonth();
          }}
        />
      )}
    </div>
  );
}
