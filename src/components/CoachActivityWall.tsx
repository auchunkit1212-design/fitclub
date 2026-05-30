"use client";

import { useMemo, useState } from "react";
import { getMealStatus } from "@/lib/ai-mock";
import { errorMessage } from "@/lib/errors";
import { getSessionRequestHeaders } from "@/lib/session";
import type { MealLog, RegistryUser, StudentNutritionTargets } from "@/lib/types";

const STICKERS = ["👍", "🔥", "💪", "⭐", "🎯", "❤️", "👏", "🥗"];

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface CoachActivityWallProps {
  logs: MealLog[];
  students: RegistryUser[];
  onToast: (msg: string) => void;
}

export function CoachActivityWall({
  logs,
  students,
  onToast,
}: CoachActivityWallProps) {
  const [targetStudent, setTargetStudent] = useState(students[0]?.email ?? "");
  const [targets, setTargets] = useState({
    targetCalories: 2000,
    targetProtein: 120,
    targetCarbs: 200,
    targetFats: 65,
    locked: false,
  });
  const [savingTargets, setSavingTargets] = useState(false);

  const recentLogs = useMemo(
    () => logs.slice(0, 30),
    [logs]
  );

  const loadTargets = async (email: string) => {
    if (!email) return;
    const res = await fetch(
      `/api/coach/student-targets?studentEmail=${encodeURIComponent(email)}`
    );
    const data = (await res.json()) as { targets?: StudentNutritionTargets | null };
    if (data.targets) {
      setTargets({
        targetCalories: data.targets.targetCalories,
        targetProtein: data.targets.targetProtein,
        targetCarbs: data.targets.targetCarbs,
        targetFats: data.targets.targetFats,
        locked: data.targets.locked,
      });
    }
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
        onToast(`已送出 ${sticker} 給學員`);
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
    setSavingTargets(true);
    try {
      const res = await fetch("/api/coach/student-targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmail: targetStudent,
          ...targets,
        }),
      });
      if (res.ok) onToast(targets.locked ? "已鎖定學員目標並推送通知" : "目標已更新");
      else onToast("儲存失敗");
    } finally {
      setSavingTargets(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-zinc-800">📜 教練聖旨 · 遠端控球</h2>
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
                type="number"
                value={targets[key]}
                onChange={(e) =>
                  setTargets((t) => ({ ...t, [key]: Number(e.target.value) }))
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
        <h2 className="font-semibold text-zinc-800 mb-3">📣 動態牆 · 即時批閱</h2>
        <ul className="space-y-3 max-h-[480px] overflow-y-auto">
          {recentLogs.map((log) => {
            const student = students.find((s) => s.email === log.email);
            const status = getMealStatus(log);
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
                    <p className="text-sm text-zinc-700 truncate">{log.description}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(log.date).toLocaleString("zh-HK")} · {log.calories} kcal
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                      status === "優良"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {STICKERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendReaction(log, s)}
                      className={`text-lg px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-amber-50 ${btnClass}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
