"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart2, Brain, IconLabel, Loader2 } from "@/components/icons";
import { fetchAiCoachReport } from "@/lib/ai-feedback-client";
import {
  buildCoachReportStats,
  complianceRate,
  DEFAULT_TARGETS,
  type CoachReportStats,
} from "@/lib/coach-report-stats";
import {
  fetchMealLogsForSession,
  filterStudentsForSession,
} from "@/lib/db";
import { getSessionRequestHeaders } from "@/lib/session";
import type {
  MealLog,
  RegistryUser,
  StudentNutritionTargets,
  UserSession,
} from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  session: UserSession;
  registry: RegistryUser[];
  gymName?: string;
  onToast?: (message: string) => void;
  variant?: "dark" | "light";
};

function StatChip({
  label,
  value,
  tone,
  isDark,
}: {
  label: string;
  value: string | number;
  tone: "green" | "amber" | "rose" | "orange" | "slate";
  isDark: boolean;
}) {
  const tones = {
    green: isDark
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
      : "bg-emerald-50 text-emerald-800 border-emerald-100",
    amber: isDark
      ? "bg-amber-500/20 text-amber-100 border-amber-400/30"
      : "bg-amber-50 text-amber-800 border-amber-100",
    rose: isDark
      ? "bg-rose-500/20 text-rose-100 border-rose-400/30"
      : "bg-rose-50 text-rose-800 border-rose-100",
    orange: isDark
      ? "bg-orange-500/20 text-orange-100 border-orange-400/30"
      : "bg-orange-50 text-orange-900 border-orange-100",
    slate: isDark
      ? "bg-white/10 text-white border-white/15"
      : "bg-zinc-50 text-zinc-800 border-zinc-100",
  } as const;

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[10px] font-semibold opacity-80">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function IssueList({
  title,
  empty,
  items,
  isDark,
  tone,
}: {
  title: string;
  empty: string;
  items: Array<{ date: string; label: string; current: number; target: number }>;
  isDark: boolean;
  tone: "over" | "low";
}) {
  return (
    <div
      className={`rounded-xl border p-3 space-y-2 ${
        isDark ? "bg-white/5 border-white/10" : "bg-white border-zinc-100"
      }`}
    >
      <p
        className={`text-xs font-bold ${
          tone === "over"
            ? isDark
              ? "text-orange-200"
              : "text-orange-700"
            : isDark
              ? "text-rose-200"
              : "text-rose-700"
        }`}
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p className={`text-xs ${isDark ? "text-white/60" : "text-zinc-500"}`}>
          {empty}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li
              key={`${item.date}-${item.label}-${idx}`}
              className={`text-xs leading-relaxed ${
                isDark ? "text-white/85" : "text-zinc-700"
              }`}
            >
              <span className="font-semibold">{item.date}</span>
              {" · "}
              {item.label}{" "}
              <span className="tabular-nums">
                {Math.round(item.current)}
                {item.label === "熱量" ? " kcal" : "g"} / 目標{" "}
                {Math.round(item.target)}
                {item.label === "熱量" ? " kcal" : "g"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [stats, setStats] = useState<CoachReportStats | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);

  useEffect(() => {
    setAiNotes(null);
    setStats(null);
  }, [selectedEmail]);

  useEffect(() => {
    if (selectedEmail === "all") {
      setTargets(DEFAULT_TARGETS);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/coach/student-targets?studentEmail=${encodeURIComponent(selectedEmail)}`,
          { credentials: "include", headers: getSessionRequestHeaders() }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          targets?: StudentNutritionTargets | null;
        };
        if (cancelled || !data.targets) return;
        setTargets({
          calories: data.targets.targetCalories,
          protein: data.targets.targetProtein,
          carbs: data.targets.targetCarbs,
          fats: data.targets.targetFats,
        });
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEmail]);

  const selectedStudent = students.find((s) => s.email === selectedEmail);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setAiNotes(null);
    setStats(null);
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
        setStats(buildCoachReportStats([], targets));
        setAiNotes(
          `${selectedStudent?.name ?? "此學員"}暫無飲食打卡，等佢記低第一餐後再整合。`
        );
        return;
      }

      const nextStats = buildCoachReportStats(filtered, targets);
      setStats(nextStats);

      const report = await fetchAiCoachReport({
        logs: filtered,
        gymName: gymName ?? session.gym,
        studentName:
          selectedEmail === "all" ? undefined : selectedStudent?.name,
      });
      setAiNotes(report);
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
          <span className="inline-flex items-center justify-center gap-2 text-white">
            <Loader2 size={18} className="animate-spin shrink-0" aria-hidden />
            正在整理報告…
          </span>
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

      {isGenerating ? (
        <div
          className={`rounded-xl border px-4 py-5 space-y-3 ${
            isDark
              ? "bg-white/5 border-white/10"
              : "bg-emerald-50/60 border-emerald-100"
          }`}
        >
          <div className="flex items-center gap-2">
            <Loader2
              size={18}
              className={`animate-spin shrink-0 ${
                isDark ? "text-indigo-200" : "text-emerald-600"
              }`}
              aria-hidden
            />
            <p
              className={`text-sm font-semibold ${
                isDark ? "text-white" : "text-emerald-900"
              }`}
            >
              正在分析打卡紀錄
            </p>
          </div>
          <ul
            className={`text-xs space-y-1.5 leading-relaxed ${
              isDark ? "text-white/70" : "text-emerald-800/80"
            }`}
          >
            <li>· 統計打卡日數同達標日</li>
            <li>· 找出超標同不足嘅營養素</li>
            <li>· 整理教練可用建議</li>
          </ul>
        </div>
      ) : null}

      {stats ? (
        <div className="space-y-3 animate-fade-slide-in">
          <div className="grid grid-cols-2 gap-2">
            <StatChip
              label="打卡日數"
              value={stats.loggedDays}
              tone="slate"
              isDark={isDark}
            />
            <StatChip
              label="達標日數"
              value={`${stats.metDays}（${complianceRate(stats)}%）`}
              tone="green"
              isDark={isDark}
            />
            <StatChip
              label="超標日數"
              value={stats.overDays}
              tone="orange"
              isDark={isDark}
            />
            <StatChip
              label="未達日數"
              value={stats.lowDays}
              tone="rose"
              isDark={isDark}
            />
          </div>

          <p className={`text-[11px] ${isDark ? "text-white/55" : "text-zinc-500"}`}>
            共 {stats.mealCount} 餐 · 平均 {stats.avgCalories} kcal/餐 · 對照目標{" "}
            {stats.targets.calories} kcal / P{stats.targets.protein}g / C
            {stats.targets.carbs}g / F{stats.targets.fats}g
            {stats.partialDays > 0 ? ` · 注意日 ${stats.partialDays}` : ""}
          </p>

          <IssueList
            title="超標（需要收一收）"
            empty="近期未見明顯超標日。"
            items={stats.overIssues}
            isDark={isDark}
            tone="over"
          />
          <IssueList
            title="不足（要加多啲）"
            empty="近期未見明顯不足，繼續保持。"
            items={stats.lowIssues}
            isDark={isDark}
            tone="low"
          />
        </div>
      ) : null}

      {aiNotes ? (
        <details
          className={`rounded-xl border ${
            isDark ? "bg-white/5 border-white/10" : "bg-zinc-50 border-zinc-100"
          }`}
        >
          <summary
            className={`cursor-pointer px-3 py-2.5 text-xs font-semibold ${
              isDark ? "text-indigo-200" : "text-zinc-700"
            }`}
          >
            AI 詳細建議（可展開）
          </summary>
          <pre
            className={`px-3 pb-3 text-xs whitespace-pre-wrap leading-relaxed ${
              isDark ? "text-white/80" : "text-zinc-700"
            }`}
          >
            {aiNotes.replace(/\*\*/g, "")}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
