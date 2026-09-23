"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart2, IconLabel, Loader2 } from "@/components/icons";
import { fetchAiCoachReport } from "@/lib/ai-feedback-client";
import {
  buildCoachReportStats,
  complianceRate,
  DEFAULT_TARGETS,
  type CoachReportStats,
  type DayMacroIssue,
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
import type { MacroTargets } from "@/lib/nutrition-compliance";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  session: UserSession;
  registry: RegistryUser[];
  gymName?: string;
  onToast?: (message: string) => void;
  /** Kept for back-compat; coach home always uses the light friendly style. */
  variant?: "dark" | "light";
};

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "green" | "amber" | "rose" | "orange" | "slate";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-800 border-emerald-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    rose: "bg-rose-50 text-rose-800 border-rose-100",
    orange: "bg-orange-50 text-orange-900 border-orange-100",
    slate: "bg-zinc-50 text-zinc-800 border-zinc-100",
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
  tone,
}: {
  title: string;
  empty: string;
  items: DayMacroIssue[];
  tone: "over" | "low";
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3 space-y-2">
      <p
        className={`text-xs font-bold ${
          tone === "over" ? "text-orange-700" : "text-rose-700"
        }`}
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li
              key={`${item.studentEmail}-${item.date}-${item.label}-${idx}`}
              className="text-xs leading-relaxed text-zinc-700"
            >
              <span className="font-semibold text-emerald-800">
                {item.studentName}
              </span>
              {" · "}
              <span className="font-medium text-zinc-500">{item.date}</span>
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

async function fetchTargetsForStudent(
  studentEmail: string
): Promise<MacroTargets | null> {
  try {
    const res = await fetch(
      `/api/coach/student-targets?studentEmail=${encodeURIComponent(studentEmail)}`,
      { credentials: "include", headers: getSessionRequestHeaders() }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      targets?: StudentNutritionTargets | null;
    };
    if (!data.targets) return null;
    return {
      calories: data.targets.targetCalories,
      protein: data.targets.targetProtein,
      carbs: data.targets.targetCarbs,
      fats: data.targets.targetFats,
    };
  } catch {
    return null;
  }
}

export function CoachAiReportPanel({
  session,
  registry,
  gymName,
  onToast,
}: Props) {
  const students = useMemo(
    () => filterStudentsForSession(session, registry),
    [session, registry]
  );
  const nameByEmail = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) {
      map[s.email.trim().toLowerCase()] = s.name;
    }
    return map;
  }, [students]);
  const studentEmailSet = useMemo(
    () => new Set(Object.keys(nameByEmail)),
    [nameByEmail]
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
      const next = await fetchTargetsForStudent(selectedEmail);
      if (!cancelled && next) setTargets(next);
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

      // Only count this coach's roster students — never merge unrelated logs.
      const rosterLogs = logs.filter((l) =>
        studentEmailSet.has(l.email.trim().toLowerCase())
      );

      const filtered =
        selectedEmail === "all"
          ? rosterLogs
          : rosterLogs.filter(
              (l) =>
                l.email.trim().toLowerCase() ===
                selectedEmail.trim().toLowerCase()
            );

      if (filtered.length === 0) {
        const who =
          selectedEmail === "all"
            ? "全部學員"
            : (selectedStudent?.name ?? "此學員");
        onToast?.(`${who}暫無飲食記錄`);
        setStats(
          buildCoachReportStats([], targets, { nameByEmail })
        );
        setAiNotes(
          selectedEmail === "all"
            ? "暫無學員打卡記錄，等有人記低第一餐後再整理。"
            : `${selectedStudent?.name ?? "此學員"}暫無飲食打卡，等佢記低第一餐後再整理。`
        );
        return;
      }

      let targetsByEmail: Record<string, MacroTargets> | undefined;
      if (selectedEmail === "all") {
        const emails = Array.from(
          new Set(filtered.map((l) => l.email.trim().toLowerCase()))
        );
        const pairs = await Promise.all(
          emails.map(async (email) => {
            const t = await fetchTargetsForStudent(email);
            return [email, t] as const;
          })
        );
        targetsByEmail = {};
        for (const [email, t] of pairs) {
          if (t) targetsByEmail[email] = t;
        }
      }

      const nextStats = buildCoachReportStats(filtered, targets, {
        nameByEmail,
        targetsByEmail,
      });
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
          ? `已整理 ${nextStats.studentCount} 位學員飲食報告！`
          : `已整理 ${selectedStudent?.name ?? "學員"} 嘅飲食報告！`
      );
    } catch {
      onToast?.("暫時讀唔到飲食記錄，請稍後再試。");
    } finally {
      setIsGenerating(false);
    }
  };

  const buttonLabel =
    selectedEmail === "all"
      ? "整理全部學員飲食報告"
      : `整理 ${selectedStudent?.name ?? "學員"} 嘅飲食報告`;

  const isAll = selectedEmail === "all";

  return (
    <section className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-emerald-800">
          <IconLabel icon={BarChart2} iconClassName="text-emerald-600">
            學員飲食報告
          </IconLabel>
        </h2>
        <p className="text-xs text-zinc-500 leading-relaxed pl-0.5">
          揀一位學員，或者一次過睇晒全部人嘅打卡同達標情況（每位學員分開計）。
        </p>
      </div>

      <div>
        <label className="text-xs text-zinc-500">睇邊位學員</label>
        <select
          value={selectedEmail}
          onChange={(e) => setSelectedEmail(e.target.value)}
          className="w-full mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900"
        >
          <option value="all">全部學員（{students.length} 人）</option>
          {students.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </select>
        {students.length === 0 && (
          <p className="text-[11px] mt-1.5 text-zinc-500">
            暫無學員，請先喺「學員」分欄新增。
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={isGenerating || students.length === 0}
        onClick={handleGenerateReport}
        className={`w-full py-3 font-semibold rounded-xl disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700 text-white ${btnClass}`}
      >
        {isGenerating ? (
          <span className="inline-flex items-center justify-center gap-2 text-white">
            <Loader2 size={18} className="animate-spin shrink-0" aria-hidden />
            正在整理報告…
          </span>
        ) : (
          <IconLabel
            icon={BarChart2}
            size="md"
            className="justify-center"
            iconClassName="text-white"
          >
            {buttonLabel}
          </IconLabel>
        )}
      </button>

      {isGenerating ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-5 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2
              size={18}
              className="animate-spin shrink-0 text-emerald-600"
              aria-hidden
            />
            <p className="text-sm font-semibold text-emerald-900">
              正在整理打卡紀錄
            </p>
          </div>
          <ul className="text-xs space-y-1.5 leading-relaxed text-emerald-800/80">
            <li>· 按每位學員每日分開統計</li>
            <li>· 找出超標同不足嘅營養素</li>
            <li>· 列出需要跟進嘅學員名</li>
          </ul>
        </div>
      ) : null}

      {stats ? (
        <div className="space-y-3 animate-fade-slide-in">
          <div className="grid grid-cols-2 gap-2">
            <StatChip
              label={isAll ? "打卡人次（人×日）" : "打卡日數"}
              value={stats.loggedDays}
              tone="slate"
            />
            <StatChip
              label={isAll ? "達標人次" : "達標日數"}
              value={`${stats.metDays}（${complianceRate(stats)}%）`}
              tone="green"
            />
            <StatChip
              label={isAll ? "超標人次" : "超標日數"}
              value={stats.overDays}
              tone="orange"
            />
            <StatChip
              label={isAll ? "未達人次" : "未達日數"}
              value={stats.lowDays}
              tone="rose"
            />
          </div>

          <p className="text-[11px] text-zinc-500">
            {isAll ? `${stats.studentCount} 位學員 · ` : ""}
            共 {stats.mealCount} 餐 · 平均 {stats.avgCalories} kcal/餐
            {!isAll
              ? ` · 對照目標 ${stats.targets.calories} kcal / P${stats.targets.protein}g / C${stats.targets.carbs}g / F${stats.targets.fats}g`
              : " · 每位學員用自己嘅目標對照"}
            {stats.partialDays > 0
              ? ` · 注意${isAll ? "人次" : "日"} ${stats.partialDays}`
              : ""}
          </p>

          <IssueList
            title="超標（需要收一收）"
            empty="近期未見明顯超標。"
            items={stats.overIssues}
            tone="over"
          />
          <IssueList
            title="不足（要加多啲）"
            empty="近期未見明顯不足，繼續保持。"
            items={stats.lowIssues}
            tone="low"
          />
        </div>
      ) : null}

      {aiNotes ? (
        <details className="rounded-xl border border-zinc-100 bg-zinc-50">
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-zinc-700">
            更多跟進建議（可展開）
          </summary>
          <pre className="px-3 pb-3 text-xs whitespace-pre-wrap leading-relaxed text-zinc-700">
            {aiNotes.replace(/\*\*/g, "")}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
