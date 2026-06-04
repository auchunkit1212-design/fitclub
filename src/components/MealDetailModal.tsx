"use client";

import { getMealImageSrc } from "@/lib/meal-display";
import { getMealStatus, mealStatusStyles } from "@/lib/meal-status";
import type { MealLog } from "@/lib/types";

interface MealDetailModalProps {
  log: MealLog;
  studentName?: string;
  onClose: () => void;
}

export function MealDetailModal({
  log,
  studentName,
  onClose,
}: MealDetailModalProps) {
  const imageSrc = getMealImageSrc(log);
  const status = getMealStatus(log);
  const displayMacros = {
    calories: Number.isFinite(Number(log.calories)) ? Number(log.calories) : 0,
    protein: Number.isFinite(Number(log.protein)) ? Number(log.protein) : 0,
    carbs: Number.isFinite(Number(log.carbs)) ? Number(log.carbs) : 0,
    fats: Number.isFinite(Number(log.fats)) ? Number(log.fats) : 0,
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
          <div>
            <p className="text-xs text-zinc-500">{studentName ?? log.email}</p>
            <h2 className="text-lg font-bold text-zinc-900">
              {log.mealType} · {log.description}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {new Date(log.date).toLocaleString("zh-HK")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 w-8 h-8 rounded-full bg-zinc-100"
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
          <div className="flex items-center justify-between">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${mealStatusStyles(status)}`}>
              {status}
            </span>
            <span className="text-2xl font-bold text-zinc-900">{displayMacros.calories} kcal</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["蛋白質", displayMacros.protein, "g", "text-emerald-600"],
                ["碳水", displayMacros.carbs, "g", "text-amber-600"],
                ["脂肪", displayMacros.fats, "g", "text-rose-600"],
              ] as const
            ).map(([label, val, unit, color]) => (
              <div
                key={label}
                className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3 text-center"
              >
                <p className="text-xs text-zinc-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>
                  {val}
                  <span className="text-sm font-medium">{unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
