"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart2, Brain, IconLabel, Loader2 } from "@/components/icons";
import { fetchAiCoachReport } from "@/lib/ai-feedback-client";
import {
  fetchMealLogsForSession,
  filterStudentsForSession,
} from "@/lib/db";
import type { MealLog, RegistryUser, UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  session: UserSession;
  registry: RegistryUser[];
  gymName?: string;
  onToast?: (message: string) => void;
  variant?: "dark" | "light";
};

export function CoachAiReportPanel({
  session,
  registry,
  gymName,
  onToast,
  variant = "dark",
}: Props) {
  const students = useMemo(
    () => filterStudentsForSession(session, registry),
    [session, registry]
  );
  const [selectedEmail, setSelectedEmail] = useState<string>("all");
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setAiReport(null);
  }, [selectedEmail]);

  const selectedStudent = students.find((s) => s.email === selectedEmail);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setAiReport(null);
    try {
      const logs: MealLog[] = await fetchMealLogsForSession(session, registry);
      const filtered =
        selectedEmail === "all"
          ? logs
          : logs.filter(
              (l) =>
                l.email.trim().toLowerCase() ===
                selectedEmail.trim().toLowerCase()
            );

      if (selectedEmail !== "all" && filtered.length === 0) {
        onToast?.(`${selectedStudent?.name ?? "此學員"}暫無飲食記錄`);
        setAiReport(
          `${selectedStudent?.name ?? "此學員"}暫無飲食打卡，等佢記低第一餐後再整合。`
        );
        return;
      }

      const report = await fetchAiCoachReport({
        logs: filtered,
        gymName: gymName ?? session.gym,
        studentName:
          selectedEmail === "all" ? undefined : selectedStudent?.name,
      });
      setAiReport(report);
      onToast?.(
        selectedEmail === "all"
          ? "已整合全部學員飲食記錄！"
          : `已整合 ${selectedStudent?.name ?? "學員"} 嘅飲食記錄！`
      );
    } catch {
      onToast?.("無法從雲端讀取飲食記錄。");
    } finally {
      setIsGenerating(false);
    }
  };

  const isDark = variant === "dark";
  const buttonLabel =
    selectedEmail === "all"
      ? "整合全部學員飲食記錄"
      : `整合 ${selectedStudent?.name ?? "學員"} 飲食記錄`;

  return (
    <section
      className={
        isDark
          ? "bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-lg space-y-3"
          : "bg-white border border-gray-200 rounded-2xl p-4 shadow-md space-y-3"
      }
    >
      <h2
        className={`text-sm font-bold ${
          isDark ? "text-indigo-300" : "text-emerald-700"
        }`}
      >
        <IconLabel
          icon={isDark ? BarChart2 : Brain}
          iconClassName={isDark ? "text-indigo-300" : "text-emerald-600"}
        >
          {isDark ? "一鍵 AI 智能整合（Supabase 實時）" : "AI 數據智能整合中心"}
        </IconLabel>
      </h2>

      <div>
        <label
          className={`text-xs ${isDark ? "text-indigo-200" : "text-zinc-500"}`}
        >
          選擇學員
        </label>
        <select
          value={selectedEmail}
          onChange={(e) => setSelectedEmail(e.target.value)}
          className={`w-full mt-1 rounded-xl border px-3 py-2.5 text-sm ${
            isDark
              ? "bg-white/10 border-white/20 text-white"
              : "border-zinc-200 text-zinc-900"
          }`}
        >
          <option value="all">全部學員（一次過整合）</option>
          {students.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </select>
        {students.length === 0 && (
          <p
            className={`text-[11px] mt-1.5 ${
              isDark ? "text-indigo-200/80" : "text-zinc-500"
            }`}
          >
            暫無學員，請先喺「學員」分欄新增。
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={isGenerating || students.length === 0}
        onClick={handleGenerateReport}
        className={`w-full py-3 font-semibold rounded-xl disabled:opacity-60 ${btnClass} ${
          isDark ? "bg-indigo-600" : "bg-emerald-600 text-white"
        }`}
      >
        {isGenerating ? (
          <IconLabel
            icon={Loader2}
            size="md"
            className="justify-center animate-spin"
            iconClassName="text-white"
          >
            從雲端整合緊...
          </IconLabel>
        ) : (
          <IconLabel
            icon={Brain}
            size="md"
            className="justify-center"
            iconClassName="text-white"
          >
            {buttonLabel}
          </IconLabel>
        )}
      </button>

      {aiReport && (
        <pre
          className={`p-3 rounded-xl text-xs whitespace-pre-wrap border ${
            isDark
              ? "bg-white/10 border-white/10"
              : "bg-zinc-50 border-zinc-100 text-zinc-800"
          }`}
        >
          {aiReport}
        </pre>
      )}
    </section>
  );
}
