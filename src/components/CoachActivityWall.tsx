"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  ClipboardList,
  Copy,
  IconLabel,
  MEAL_STICKERS,
  Megaphone,
  MessageCircle,
  ScrollText,
  Smartphone,
} from "@/components/icons";
import { MealDetailModal } from "@/components/MealDetailModal";
import { errorMessage } from "@/lib/errors";
import { getMealStatus, mealStatusStyles } from "@/lib/meal-status";
import { getSession, getSessionRequestHeaders } from "@/lib/session";
import type { MealLog, RegistryUser, StudentNutritionTargets } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type TargetFieldKey =
  | "targetCalories"
  | "targetProtein"
  | "targetCarbs"
  | "targetFats";

type TargetFormState = Record<TargetFieldKey, string> & { locked: boolean };

const DEFAULT_TARGETS: TargetFormState = {
  targetCalories: "2000",
  targetProtein: "120",
  targetCarbs: "200",
  targetFats: "65",
  locked: false,
};

function sanitizeTargetInput(raw: string): string {
  if (raw === "") return "";
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  return digits.replace(/^0+(?=\d)/, "");
}

function targetsFromApi(data: StudentNutritionTargets): TargetFormState {
  return {
    targetCalories: String(data.targetCalories),
    targetProtein: String(data.targetProtein),
    targetCarbs: String(data.targetCarbs),
    targetFats: String(data.targetFats),
    locked: data.locked,
  };
}

function targetsToPayload(form: TargetFormState) {
  return {
    targetCalories: parseInt(form.targetCalories, 10) || 0,
    targetProtein: parseInt(form.targetProtein, 10) || 0,
    targetCarbs: parseInt(form.targetCarbs, 10) || 0,
    targetFats: parseInt(form.targetFats, 10) || 0,
    locked: form.locked,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildNudgeMessage(
  studentName: string,
  coachName: string,
  todayMealCount = 0
): string {
  const mealLine =
    todayMealCount === 0
      ? `${coachName} 教練想提醒你今日仲未記錄任何飲食！`
      : `${coachName} 教練見你今日已記錄 ${todayMealCount} 餐，請繼續補記同保持完整打卡！`;

  return `喂 ${studentName}！我係 Nutrition Coach 大猩猩教練助手～

${mealLine}

快啲打開 App 影相打卡，等我哋幫你分析熱量同 Macros。記得飲水！

— Nutrition Coach · Coach! what to eat?`;
}

function buildPushNudgeBody(coachName: string, todayMealCount: number): string {
  if (todayMealCount === 0) {
    return `${coachName} 教練提醒你：今日仲未記錄飲食，快打開 App 打卡！記得飲水。`;
  }
  return `${coachName} 教練提醒你：今日已記 ${todayMealCount} 餐，請繼續補記同飲水，保持完整打卡！`;
}

interface CoachActivityWallProps {
  logs: MealLog[];
  students: RegistryUser[];
  onToast: (msg: string) => void;
  onLogUpdated?: (log: MealLog) => void;
}

export function CoachActivityWall({
  logs,
  students,
  onToast,
  onLogUpdated,
}: CoachActivityWallProps) {
  const [targetStudent, setTargetStudent] = useState(students[0]?.email ?? "");
  const [targets, setTargets] = useState<TargetFormState>(DEFAULT_TARGETS);
  const [savingTargets, setSavingTargets] = useState(false);
  const [selectedLog, setSelectedLog] = useState<MealLog | null>(null);
  const [nudgeStudent, setNudgeStudent] = useState<RegistryUser | null>(null);
  const [nudgeSending, setNudgeSending] = useState(false);

  const recentLogs = useMemo(() => logs.slice(0, 30), [logs]);

  const todayMealCountByEmail = useMemo(() => {
    const today = todayIso();
    const map = new Map<string, number>();
    for (const log of logs) {
      if (log.date.slice(0, 10) !== today) continue;
      map.set(log.email, (map.get(log.email) ?? 0) + 1);
    }
    return map;
  }, [logs]);

  const loadTargets = async (email: string) => {
    if (!email) return;
    const res = await fetch(
      `/api/coach/student-targets?studentEmail=${encodeURIComponent(email)}`,
      { credentials: "include", headers: getSessionRequestHeaders() }
    );
    const data = (await res.json()) as { targets?: StudentNutritionTargets | null };
    if (data.targets) setTargets(targetsFromApi(data.targets));
  };

  const sendReaction = async (log: MealLog, sticker: string) => {
    try {
      const res = await fetch("/api/coach/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          mealLogId: log.id,
          sticker,
          studentEmail: log.email,
        }),
      });

      const data = (await res.json()) as { error?: string; hint?: string };

      if (res.ok) {
        onToast("已送出評價給學員");
        return;
      }

      console.error("發送 reaction 失敗:", {
        status: res.status,
        error: data.error,
        hint: data.hint,
        mealLogId: log.id,
      });
      onToast(data.error ?? `發送失敗 (HTTP ${res.status})`);
    } catch (err) {
      console.error("發送 reaction 失敗:", err);
      onToast(errorMessage(err, "發送失敗"));
    }
  };

  const saveTargets = async () => {
    if (!targetStudent) return;
    const payload = targetsToPayload(targets);
    if (
      !payload.targetCalories ||
      !payload.targetProtein ||
      !payload.targetCarbs ||
      !payload.targetFats
    ) {
      onToast("請填寫完整數字目標");
      return;
    }

    setSavingTargets(true);
    try {
      const session = getSession();
      const res = await fetch("/api/coach/student-targets", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          studentEmail: targetStudent,
          ...payload,
          tenantId: session?.tenantId,
        }),
      });
      const data = (await res.json()) as { error?: string; hint?: string };
      if (res.ok) {
        onToast(targets.locked ? "已鎖定學員目標並推送通知" : "目標已更新");
        return;
      }
      console.error("教練聖旨儲存失敗:", data);
      onToast(data.error ?? "儲存失敗");
    } catch (err) {
      console.error("教練聖旨儲存失敗:", err);
      onToast(errorMessage(err, "儲存失敗"));
    } finally {
      setSavingTargets(false);
    }
  };

  const copyNudge = async (msg: string) => {
    try {
      await navigator.clipboard.writeText(msg);
      onToast("已複製催餐訊息");
    } catch {
      onToast("複製失敗，請手動選取文字");
    }
  };

  const sendAppNudge = async (student: RegistryUser) => {
    const todayMealCount = todayMealCountByEmail.get(student.email) ?? 0;
    setNudgeSending(true);
    try {
      const res = await fetch("/api/coach/nudge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          studentEmail: student.email,
          message: buildPushNudgeBody(coachName, todayMealCount),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        hint?: string;
        studentName?: string;
      };

      if (res.ok && data.ok) {
        onToast(`已發送 App 通知俾 ${data.studentName ?? student.name}`);
        setNudgeStudent(null);
        return;
      }

      onToast(
        data.hint ? `${data.error} — ${data.hint}` : data.error ?? "發送失敗"
      );
    } catch (err) {
      onToast(errorMessage(err, "發送失敗"));
    } finally {
      setNudgeSending(false);
    }
  };

  const coachName = getSession()?.name ?? "教練";

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-zinc-800">
          <IconLabel icon={ScrollText} iconClassName="text-gray-600">
            教練聖旨 · 遠端控球
          </IconLabel>
        </h2>

        <ul className="space-y-2">
          {students.map((s) => {
            const count = todayMealCountByEmail.get(s.email) ?? 0;
            return (
              <li
                key={s.email}
                className="flex items-center justify-between gap-3 text-sm min-w-0"
              >
                <span className="min-w-0 flex-1 truncate">
                  {s.name}{" "}
                  <span className="text-zinc-400 text-xs whitespace-nowrap">
                    ({count} 餐今日)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setNudgeStudent(s)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 ${btnClass}`}
                  title="發送 App 提醒（有記錄都可發）"
                  aria-label={`提醒 ${s.name} 記錄飲食`}
                >
                  <Bell size={20} strokeWidth={2} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>

        <select
          value={targetStudent}
          onChange={(e) => {
            setTargetStudent(e.target.value);
            loadTargets(e.target.value);
          }}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
        >
          {students.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["熱量", "targetCalories"],
              ["蛋白", "targetProtein"],
              ["碳水", "targetCarbs"],
              ["脂肪", "targetFats"],
            ] as const
          ).map(([label, key]) => (
            <div key={key}>
              <label className="text-xs text-zinc-500">{label}</label>
              <input
                type="text"
                inputMode="numeric"
                value={targets[key]}
                onChange={(e) =>
                  setTargets((t) => ({
                    ...t,
                    [key]: sanitizeTargetInput(e.target.value),
                  }))
                }
                className="w-full mt-1 rounded-lg border border-zinc-200 px-2 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={targets.locked}
            onChange={(e) =>
              setTargets((t) => ({ ...t, locked: e.target.checked }))
            }
          />
          鎖定目標（學員端即時同步）
        </label>
        <button
          type="button"
          disabled={savingTargets}
          onClick={saveTargets}
          className={`w-full bg-zinc-900 text-white font-semibold py-3 rounded-xl disabled:opacity-60 ${btnClass}`}
        >
          {savingTargets ? "儲存中..." : "發布教練聖旨"}
        </button>
      </section>

      <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
        <h2 className="font-semibold text-zinc-800 mb-3">
          <IconLabel icon={Megaphone} iconClassName="text-gray-600">
            動態牆 · 即時批閱
          </IconLabel>
        </h2>
        <p className="text-xs text-zinc-400 mb-2">撳卡片查看大圖同完整 Macros</p>
        <ul className="space-y-3 max-h-[480px] overflow-y-auto">
          {recentLogs.map((log) => {
            const student = students.find((s) => s.email === log.email);
            const status = getMealStatus(log);
            const calories = Number.isFinite(Number(log.calories)) ? Number(log.calories) : 0;
            const protein = Number.isFinite(Number(log.protein)) ? Number(log.protein) : 0;
            const carbs = Number.isFinite(Number(log.carbs)) ? Number(log.carbs) : 0;
            const fats = Number.isFinite(Number(log.fats)) ? Number(log.fats) : 0;
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
                    <p className="font-medium text-sm">
                      {student?.name ?? log.email} · {log.mealType}
                    </p>
                    <p className="text-sm text-zinc-700 truncate">{log.description}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(log.date).toLocaleString("zh-HK")} · {calories} kcal · P{protein} C
                      {carbs} F{fats}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold h-fit ${mealStatusStyles(status)}`}
                  >
                    {status}
                  </span>
                </div>
                <div
                  className="flex flex-wrap gap-1.5 mt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {MEAL_STICKERS.map(({ id, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => sendReaction(log, id)}
                      className={`px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-amber-50 text-amber-800 ${btnClass}`}
                      aria-label={id}
                    >
                      <Icon size={20} strokeWidth={2} aria-hidden />
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {selectedLog && (
        <MealDetailModal
          log={selectedLog}
          studentName={
            students.find((s) => s.email === selectedLog.email)?.name
          }
          onClose={() => setSelectedLog(null)}
          onUpdated={(updated) => {
            setSelectedLog(updated);
            onLogUpdated?.(updated);
            onToast("飲食記錄已更新");
          }}
        />
      )}

      {nudgeStudent && (() => {
        const mealCount = todayMealCountByEmail.get(nudgeStudent.email) ?? 0;
        const nudgeText = buildNudgeMessage(
          nudgeStudent.name,
          coachName,
          mealCount
        );
        return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-zinc-900">
              <IconLabel icon={Bell} iconClassName="text-emerald-600">
                提醒 {nudgeStudent.name} 記錄
              </IconLabel>
            </h3>
            <p className="text-xs text-zinc-500">
              今日已記錄 {mealCount} 餐 · 有記錄都可以再發提醒
            </p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-amber-50 rounded-xl p-3 border border-amber-100">
              {nudgeText}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={nudgeSending}
                onClick={() => sendAppNudge(nudgeStudent)}
                className={`w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60 ${btnClass}`}
              >
                <IconLabel icon={Smartphone} size="md" className="justify-center" iconClassName="text-white">
                  {nudgeSending ? "發送中..." : "發送 App 通知（鎖屏提醒）"}
                </IconLabel>
              </button>
              <button
                type="button"
                onClick={() => copyNudge(nudgeText)}
                className={`w-full py-3 rounded-xl bg-zinc-900 text-white font-semibold ${btnClass}`}
              >
                <IconLabel icon={ClipboardList} size="md" className="justify-center" iconClassName="text-white">
                  複製文字訊息
                </IconLabel>
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(nudgeText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full py-3 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-semibold text-center inline-flex items-center justify-center gap-2 ${btnClass}`}
              >
                <MessageCircle size={20} strokeWidth={2} className="shrink-0 text-gray-600" aria-hidden />
                WhatsApp 轉發
              </a>
              <button
                type="button"
                onClick={() => setNudgeStudent(null)}
                className={`w-full py-2 text-zinc-500 text-sm ${btnClass}`}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
