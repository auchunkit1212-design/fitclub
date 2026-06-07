"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { ServingPortionPicker } from "@/components/ServingPortionPicker";
import { formatCompositeBreakdown } from "@/lib/composite-meal";
import type { DetectedMealFood } from "@/lib/meal-photo-detect";
import { scaleMacros, type MacroValues } from "@/lib/portion-scale";

type ItemPortionState = {
  ratio: number;
  portionLabel: string;
  description: string;
  macros: MacroValues;
};

export type MultiFoodTotals = {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  parts: { name: string; macros: MacroValues }[];
};

type Props = {
  foods: DetectedMealFood[];
  onTotalsChange: (totals: MultiFoodTotals) => void;
  className?: string;
};

export function MultiFoodPortionPanel({
  foods,
  onTotalsChange,
  className = "",
}: Props) {
  const { t } = useI18n();
  const [portions, setPortions] = useState<Record<number, ItemPortionState>>({});

  const handleItemPortion = useCallback(
    (index: number, food: DetectedMealFood) =>
      (ratio: number, portionLabel: string, description: string) => {
        const macros = scaleMacros(
          {
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fats: food.fats,
          },
          ratio
        );
        setPortions((prev) => ({
          ...prev,
          [index]: { ratio, portionLabel, description, macros },
        }));
      },
    []
  );

  const totals = useMemo(() => {
    const parts = foods.map((food, index) => {
      const state = portions[index];
      return {
        name: state?.description ?? food.name,
        macros:
          state?.macros ??
          ({
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fats: food.fats,
          } satisfies MacroValues),
      };
    });

    const sum = parts.reduce(
      (acc, p) => ({
        calories: acc.calories + p.macros.calories,
        protein: acc.protein + p.macros.protein,
        carbs: acc.carbs + p.macros.carbs,
        fats: acc.fats + p.macros.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

    return {
      description: parts.map((p) => p.name).join(" + "),
      calories: sum.calories,
      protein: sum.protein,
      carbs: sum.carbs,
      fats: sum.fats,
      parts,
    } satisfies MultiFoodTotals;
  }, [foods, portions]);

  useEffect(() => {
    onTotalsChange(totals);
  }, [totals, onTotalsChange]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2">
        <p className="text-sm font-semibold text-violet-900">
          {t("multiFood.title", "AI 辨識到 {count} 樣食物，請逐樣選擇份量", {
            count: foods.length,
          })}
        </p>
        <p className="text-xs text-violet-700/80 mt-0.5">
          {t(
            "multiFood.hint",
            "每樣食物分開揀你實際食咗幾多，系統會自動加總。"
          )}
        </p>
      </div>

      {foods.map((food, index) => (
        <div
          key={`${food.name}-${index}`}
          className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-zinc-900">{food.name}</p>
              {food.portionHint ? (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t("multiFood.visiblePortion", "相片中：{hint}", {
                    hint: food.portionHint,
                  })}
                </p>
              ) : null}
            </div>
            <p className="text-xs text-zinc-500 shrink-0 text-right">
              {t("multiFood.baseServing", "全份約 {cal} kcal", {
                cal: food.calories,
              })}
            </p>
          </div>

          <ServingPortionPicker
            baseWeightG={food.baseWeightG}
            productName={food.name}
            onPortionChange={handleItemPortion(index, food)}
          />

          {portions[index] ? (
            <p className="text-xs text-emerald-700 font-medium">
              {t("multiFood.itemTotal", "呢樣：{cal} kcal · 蛋白 {pro}g", {
                cal: portions[index].macros.calories,
                pro: portions[index].macros.protein,
              })}
            </p>
          ) : null}
        </div>
      ))}

      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-900">
          {t("multiFood.combinedTotal", "合計")}
        </p>
        <p className="text-lg font-bold text-emerald-700 mt-1">
          {totals.calories} kcal · {t("common.protein", "蛋白")} {totals.protein}
          g
        </p>
        <p className="text-xs text-emerald-800/80 mt-1 break-words">
          {formatCompositeBreakdown(
            totals.parts.map((p) => ({ name: p.name, macros: p.macros }))
          )}
        </p>
      </div>
    </div>
  );
}
