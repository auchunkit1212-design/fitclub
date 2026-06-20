"use client";

import { useEffect, useMemo, useState } from "react";
import { HistoryCalendar } from "@/components/HistoryCalendar";
import { Download, IconLabel } from "@/components/icons";
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
  const [selectedEmail, setSelectedEmail] = useState("");
  const [fromDate, setFromDate] = useState(daysAgoIso(30));
  const [toDate, setToDate] = useState(todayIsoDate());

  useEffect(() => {
    if (selectedEmail) return;
    if (students[0]?.email) {
      setSelectedEmail(students[0].email);
    }
  }, [students, selectedEmail]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const day = log.date.slice(0, 10);
      if (day < fromDate || day > toDate) return false;
      if (selectedEmail && log.email !== selectedEmail) return false;
      return true;
    });
  }, [logs, fromDate, toDate, selectedEmail]);

  const selectedStudent = students.find((s) => s.email === selectedEmail);

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      alert("目前篩選結果為空，無法匯出。");
      return;
    }
    const rows = buildMealExportRows(filteredLogs, students);
    const slug = gymName.replace(/\s+/g, "-").slice(0, 20) || "gym";
    downloadMealsExcel(rows, `${slug}-meal-export-${fromDate}_${toDate}.xls`);
  };

  if (students.length === 0) {
    return (
      <section className="bg-white rounded-2xl border border-zinc-100 p-6 text-center text-sm text-zinc-500">
        暫無學員，無法查看飲食歷史。
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-zinc-800">學員每日飲食歷史</h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              選擇學員後查看每月達標日曆；點日期可睇當日 P/C/F 同每餐詳情。
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className={`shrink-0 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold ${btnClass}`}
          >
            <IconLabel icon={Download} size="sm" iconClassName="text-white">
              匯出 Excel
            </IconLabel>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500">學員</label>
            <select
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
              className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
            >
              {students.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">匯出開始日期</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">匯出結束日期</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        {selectedStudent && (
          <p className="text-xs text-zinc-600 bg-zinc-50 rounded-xl px-3 py-2">
            正在查看：<span className="font-semibold">{selectedStudent.name}</span>
            {" · "}
            近 30 日共 {filteredLogs.length} 筆餐食（匯出用）
          </p>
        )}
      </section>

      {selectedEmail ? (
        <HistoryCalendar
          key={selectedEmail}
          embedded
          studentEmail={selectedEmail}
        />
      ) : null}
    </div>
  );
}
