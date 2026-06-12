"use client";

import { useMemo, useState } from "react";
import { CoachMealReviewActions } from "@/components/CoachMealReviewActions";
import { MealDetailModal } from "@/components/MealDetailModal";
import { filterUnreviewedMeals } from "@/lib/meal-review-status";
import { getMealStatus, mealStatusStyles } from "@/lib/meal-status";
import { IconLabel, ScrollText } from "@/components/icons";
import type {
  MealLog,
  MealLogFeedback,
  MealLogReaction,
  RegistryUser,
} from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  logs: MealLog[];
  students: RegistryUser[];
  coachEmail: string;
  reactions: MealLogReaction[];
  feedback: MealLogFeedback[];
  loading?: boolean;
  onReviewChange?: (mealLogId?: string) => void;
  onToast: (message: string) => void;
  onLogUpdated?: (log: MealLog) => void;
  onLogDeleted?: (id: string) => void;
};

export function CoachUnreviewedMealsPanel({
  logs,
  students,
  coachEmail,
  reactions,
  feedback,
  loading = false,
  onReviewChange,
  onToast,
  onLogUpdated,
  onLogDeleted,
}: Props) {
  const [selectedLog, setSelectedLog] = useState<MealLog | null>(null);
  const [showAll, setShowAll] = useState(false);

  const unreviewed = useMemo(
    () => filterUnreviewedMeals(logs, coachEmail, reactions, feedback),
    [logs, coachEmail, reactions, feedback]
  );

  const visible = showAll ? unreviewed : unreviewed.slice(0, 8);

  const handleReviewed = (mealLogId: string) => {
    onReviewChange?.(mealLogId);
    onToast("已標記檢閱");
  };

  return (
    <>
      <section className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-zinc-800 text-sm">
              <IconLabel icon={ScrollText} iconClassName="text-amber-600">
                未檢閱飲食紀錄
              </IconLabel>
            </h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              你尚未送出貼紙或評語嘅學員打卡（AI
              大猩猩自動批閱唔計入已檢閱）。
            </p>
          </div>
          <span className="shrink-0 min-w-[2rem] text-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
            {loading ? "…" : unreviewed.length}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400 text-center py-6">載入檢閱狀態…</p>
        ) : unreviewed.length === 0 ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-4 text-center">
            全部學員飲食已檢閱，做得好！
          </p>
        ) : (
          <>
            <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {visible.map((log) => {
                const student = students.find((s) => s.email === log.email);
                const status = getMealStatus(log);
                return (
                  <li
                    key={log.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedLog(log)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setSelectedLog(log)
                    }
                    className={`border border-amber-100 rounded-xl p-3 bg-amber-50/40 cursor-pointer hover:bg-amber-50 ${btnClass}`}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-zinc-900">
                          {student?.name ?? log.email} · {log.mealType}
                        </p>
                        <p className="text-sm text-zinc-700 truncate">
                          {log.description}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(log.date).toLocaleString("zh-HK")} ·{" "}
                          {log.calories} kcal
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                          未檢閱
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${mealStatusStyles(status)}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                    <div
                      className="mt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CoachMealReviewActions
                        log={log}
                        compact
                        onSent={() => handleReviewed(log.id)}
                        onError={(msg) => onToast(msg)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {unreviewed.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className={`w-full py-2 text-xs font-semibold text-amber-800 ${btnClass}`}
              >
                {showAll
                  ? "收合列表"
                  : `顯示全部 ${unreviewed.length} 筆未檢閱`}
              </button>
            )}
          </>
        )}
      </section>

      {selectedLog && (
        <MealDetailModal
          log={selectedLog}
          studentName={
            students.find((s) => s.email === selectedLog.email)?.name
          }
          coachReviewMode
          onClose={() => setSelectedLog(null)}
          onUpdated={(updated) => {
            setSelectedLog(updated);
            onLogUpdated?.(updated);
            onToast("飲食記錄已更新");
          }}
          onDeleted={(id) => {
            setSelectedLog(null);
            onLogDeleted?.(id);
            onReviewChange?.();
            onToast("已刪除學員飲食記錄");
          }}
          onCoachFeedbackSent={() => {
            onReviewChange?.(selectedLog.id);
            onToast("已送出評語，學員會收到 App 通知");
          }}
        />
      )}
    </>
  );
}
