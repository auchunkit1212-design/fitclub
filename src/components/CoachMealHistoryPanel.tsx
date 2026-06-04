"use client";

import { useMemo, useState } from "react";
import { getMealStatus, mealStatusStyles } from "@/lib/meal-status";
import {
  buildMealExportRows,
  downloadMealsExcel,
} from "@/lib/csv-export";
import type { MealLog, RegistryUser } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface CoachMealHistoryPanelProps {
  logs: MealLog[];
  students: RegistryUser[];
  gymName: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function CoachMealHistoryPanel({
  logs,
  students,
  gymName,
}: CoachMealHistoryPanelProps) {
  const [selectedEmail, setSelectedEmail] = useState<string>("all");
  const [fromDate, setFromDate] = useState(daysAgoIso(7));
  const [toDate, setToDate] = useState(todayIsoDate());

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const day = log.date.slice(0, 10);
      if (day < fromDate || day > toDate) return false;
      if (selectedEmail !== "all" && log.email !== selectedEmail) return false;
      return true;
    });
  }, [logs, fromDate, toDate, selectedEmail]);

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      alert("目前篩選結果為空，無法匯出。");
      return;
    }
    const rows = buildMealExportRows(filteredLogs, students);
    const slug = gymName.replace(/\s+/g, "-").slice(0, 20) || "gym";
    downloadMealsExcel(rows, `${slug}-meal-export-${fromDate}_${toDate}.xls`);
  };

  return (
    <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-800">
          學員飲食歷史 ({filteredLogs.length})
        </h2>
        <button
          type="button"
          onClick={handleExport}
          className={`shrink-0 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold ${btnClass}`}
        >
          📥 匯出 Excel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs text-zinc-500">篩選學員</label>
          <select
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
            className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
          >
            <option value="all">全部學員</option>
            {students.map((s) => (
              <option key={s.email} value={s.email}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">開始日期</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">結束日期</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-6">
          此篩選條件下暫無記錄。
        </p>
      ) : (
        <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {filteredLogs.map((log) => {
            const status = getMealStatus(log);
            const student = students.find((s) => s.email === log.email);
            return (
              <li
                key={log.id}
                className="border border-zinc-100 rounded-xl p-3 bg-zinc-50"
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {student?.name ?? log.email} · {log.mealType}
                    </p>
                    <p className="text-sm text-zinc-700 mt-0.5 truncate">
                      {log.description}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(log.date).toLocaleString("zh-HK")} · {log.calories}{" "}
                      kcal · 蛋白 {log.protein}g
                    </p>
                  </div>
                  <span
                    className={`shrink-0 h-fit px-2 py-0.5 rounded text-[10px] font-bold ${mealStatusStyles(status)}`}
                  >
                    {status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-indigo-800 bg-indigo-50 rounded-lg px-2 py-1.5 leading-relaxed">
                  🤖 {buildMealExportRows([log], students)[0]?.aiComment}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
