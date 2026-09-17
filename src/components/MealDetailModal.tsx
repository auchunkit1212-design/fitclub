"use client";

import { useEffect, useState } from "react";
import { CoachMealReviewActions } from "@/components/CoachMealReviewActions";
import { IconLabel, Sparkles, Trash2 } from "@/components/icons";
import { errorMessage } from "@/lib/errors";
import { getMealImageSrc } from "@/lib/meal-display";
import { getMealStatus, mealStatusStyles } from "@/lib/meal-status";
import { AdvancedNutritionCard } from "@/components/AdvancedNutritionCard";
import { getSessionRequestHeaders } from "@/lib/session";
import type { MealLog } from "@/lib/types";

interface MealDetailModalProps {
  log: MealLog;
  studentName?: string;
  canEdit?: boolean;
  coachReviewMode?: boolean;
  onClose: () => void;
  onUpdated?: (log: MealLog) => void;
  onDeleted?: (id: string) => void;
  onCoachFeedbackSent?: () => void;
}

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer disabled:opacity-50";

export function MealDetailModal({
  log,
  studentName,
  canEdit = true,
  coachReviewMode = false,
  onClose,
  onUpdated,
  onDeleted,
  onCoachFeedbackSent,
}: MealDetailModalProps) {
  const imageSrc = getMealImageSrc(log);
  const status = getMealStatus(log);

  const [description, setDescription] = useState(log.description);
  const [calories, setCalories] = useState(String(log.calories ?? 0));
  const [protein, setProtein] = useState(String(log.protein ?? 0));
  const [carbs, setCarbs] = useState(String(log.carbs ?? 0));
  const [fats, setFats] = useState(String(log.fats ?? 0));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState({
    description: log.description,
    calories: log.calories ?? 0,
    protein: log.protein ?? 0,
    carbs: log.carbs ?? 0,
    fats: log.fats ?? 0,
  });

  useEffect(() => {
    const next = {
      description: log.description,
      calories: log.calories ?? 0,
      protein: log.protein ?? 0,
      carbs: log.carbs ?? 0,
      fats: log.fats ?? 0,
    };
    setBaseline(next);
    setDescription(next.description);
    setCalories(String(next.calories));
    setProtein(String(next.protein));
    setCarbs(String(next.carbs));
    setFats(String(next.fats));
    setAiNote(null);
    setError(null);
  }, [log.id, log.calories, log.protein, log.carbs, log.fats, log.description]);

  const displayMacros = {
    calories: Number(calories) || 0,
    protein: Number(protein) || 0,
    carbs: Number(carbs) || 0,
    fats: Number(fats) || 0,
  };

  const patchBody = () => ({
    description: description.trim(),
    calories: displayMacros.calories,
    protein: displayMacros.protein,
    carbs: displayMacros.carbs,
    fats: displayMacros.fats,
  });

  const hasManualMacroEdits =
    displayMacros.calories !== baseline.calories ||
    displayMacros.protein !== baseline.protein ||
    displayMacros.carbs !== baseline.carbs ||
    displayMacros.fats !== baseline.fats;

  const coachHintBody = () =>
    hasManualMacroEdits
      ? {
          coachHint: {
            calories: displayMacros.calories,
            protein: displayMacros.protein,
            carbs: displayMacros.carbs,
            fats: displayMacros.fats,
          },
        }
      : {};

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/meals/${log.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        body: JSON.stringify(patchBody()),
      });
      const data = (await res.json()) as { log?: MealLog; error?: string };
      if (!res.ok) throw new Error(data.error ?? "儲存失敗");
      if (data.log) {
        onUpdated?.(data.log);
        setBaseline({
          description: data.log.description,
          calories: data.log.calories ?? 0,
          protein: data.log.protein ?? 0,
          carbs: data.log.carbs ?? 0,
          fats: data.log.fats ?? 0,
        });
      }
      setAiNote("已儲存修正");
    } catch (e) {
      setError(errorMessage(e, "儲存失敗"));
    } finally {
      setSaving(false);
    }
  };

  const canDelete = Boolean(onDeleted) && (canEdit || coachReviewMode);

  const handleDelete = async () => {
    if (!canDelete) return;
    const who = coachReviewMode
      ? `學員「${studentName ?? log.email}」`
      : "呢餐";
    const confirmed = window.confirm(
      `確定刪除${who}嘅飲食記錄？\n\n${log.mealType} · ${description.trim() || log.description}\n\n刪除後無法復原。`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/meals/${log.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "刪除失敗");
      onDeleted?.(log.id);
      onClose();
    } catch (e) {
      setError(errorMessage(e, "刪除失敗"));
    } finally {
      setDeleting(false);
    }
  };

  const handleAiReestimate = async (apply: boolean) => {
    if (!canEdit) return;
    setAiBusy(true);
    setError(null);
    setAiNote(null);
    try {
      const res = await fetch("/api/meals/reestimate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        body: JSON.stringify({
          mealLogId: log.id,
          description: description.trim(),
          apply,
          ...coachHintBody(),
        }),
      });
      const data = (await res.json()) as {
        log?: MealLog;
        estimate?: {
          calories: number;
          protein: number;
          carbs: number;
          fats: number;
        };
        source?: string;
        parts?: { name: string; macros: { calories: number } }[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "AI 重算失敗");

      const est = data.estimate ?? data.log;
      if (est) {
        setCalories(String(est.calories));
        setProtein(String(est.protein));
        setCarbs(String(est.carbs));
        setFats(String(est.fats));
      }

      const sourceLabel =
        data.source === "openrouter" ? "AI 模型" : "本地營養規則（含容量／拆餐）";
      const partsHint =
        data.parts && data.parts.length > 1
          ? `（拆成 ${data.parts.length} 項加總）`
          : "";

      if (apply && data.log) {
        onUpdated?.(data.log);
        setBaseline({
          description: data.log.description,
          calories: data.log.calories ?? 0,
          protein: data.log.protein ?? 0,
          carbs: data.log.carbs ?? 0,
          fats: data.log.fats ?? 0,
        });
        setAiNote(`已用${sourceLabel}重算並儲存${partsHint}`);
      } else {
        setAiNote(`預覽：${sourceLabel}建議 ${est?.calories ?? "?"} kcal${partsHint} — 按「套用並儲存」寫入`);
      }
    } catch (e) {
      setError(errorMessage(e, "AI 重算失敗"));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-zinc-100 flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-500">{studentName ?? log.email}</p>
            <h2 className="text-lg font-bold text-zinc-900">{log.mealType}</h2>
            <p className="text-xs text-zinc-400 mt-1">
              {new Date(log.date).toLocaleString("zh-HK")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 w-8 h-8 rounded-full bg-zinc-100 shrink-0"
          >
            ×
          </button>
        </div>

        {imageSrc ? (
          <div className="bg-zinc-100">
            <img
              src={imageSrc}
              alt={log.description}
              className="w-full max-h-72 object-contain"
            />
          </div>
        ) : (
          <div className="bg-zinc-100 h-40 flex items-center justify-center text-zinc-400 text-sm">
            此餐未有相片
          </div>
        )}

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${mealStatusStyles(status)}`}
            >
              {status}
            </span>
            {!canEdit && (
              <span className="text-2xl font-bold text-zinc-900">
                {displayMacros.calories} kcal
              </span>
            )}
          </div>

          <AdvancedNutritionCard
            name={description.trim() || log.description}
            macros={displayMacros}
            className="border-emerald-100 bg-white"
          />

          {canEdit ? (
            <>
              <label className="block text-xs text-zinc-500">食物描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs text-zinc-500">
                  手動修正營養（kcal / P / C / F）
                </label>
                {(
                  [
                    ["熱量 kcal", calories, setCalories],
                    ["蛋白 P", protein, setProtein],
                    ["碳水 C", carbs, setCarbs],
                    ["脂肪 F", fats, setFats],
                  ] as const
                ).map(([label, val, setVal]) => (
                  <div key={label}>
                    <span className="text-xs text-zinc-500">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {aiNote && (
                <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">
                  {aiNote}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className={`w-full py-3 rounded-xl bg-zinc-900 text-white font-semibold text-sm ${btnClass}`}
                >
                  {saving ? "儲存中..." : "儲存手動修正"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => handleAiReestimate(false)}
                    className={`py-3 rounded-xl border border-violet-200 bg-violet-50 text-violet-900 font-semibold text-sm ${btnClass}`}
                  >
                    {aiBusy ? (
                      "計算中..."
                    ) : (
                      <IconLabel icon={Sparkles} size="md" iconClassName="text-violet-700">
                        AI 預覽
                      </IconLabel>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => handleAiReestimate(true)}
                    className={`py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm ${btnClass}`}
                  >
                    {aiBusy ? "計算中..." : "套用並儲存"}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  「套用並儲存」會依上方描述用 AI／本地規則重算並寫入雲端；若你已手動改數字，可先按「AI
                  預覽」對照再決定是否套用。
                </p>
                {canDelete && !coachReviewMode && (
                  <button
                    type="button"
                    disabled={deleting || saving || aiBusy}
                    onClick={handleDelete}
                    className={`w-full py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold text-sm inline-flex items-center justify-center gap-2 ${btnClass}`}
                  >
                    <Trash2 size={16} aria-hidden />
                    {deleting ? "刪除中…" : "刪除此餐記錄"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-800">{log.description}</p>
          )}

          {coachReviewMode && (
            <div className="pt-2 border-t border-zinc-100 space-y-3">
              {canDelete && (
                <button
                  type="button"
                  disabled={deleting || saving || aiBusy}
                  onClick={handleDelete}
                  className={`w-full py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold text-sm inline-flex items-center justify-center gap-2 ${btnClass}`}
                >
                  <Trash2 size={16} aria-hidden />
                  {deleting ? "刪除中…" : "刪除學員此餐記錄"}
                </button>
              )}
              <p className="text-sm font-semibold text-zinc-800 mb-2">
                批閱學員 · 貼紙同評語
              </p>
              <CoachMealReviewActions
                log={log}
                onSent={() => {
                  onCoachFeedbackSent?.();
                }}
                onError={(msg) => setError(msg)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
