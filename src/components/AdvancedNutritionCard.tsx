"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  BarChart2,
  Cuboid,
  Droplets,
  HeartPulse,
  IconLabel,
  Leaf,
  LineChart,
} from "@/components/icons";
import { ProUpgradePrompt } from "@/components/ProUpgradePrompt";
import { resolveFoodAdvancedNutrients } from "@/lib/food-advanced-nutrients";
import { hasProAccessFromSession } from "@/lib/plan-access";
import type { FoodAdvancedNutrients } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

type MacroInput = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

interface AdvancedNutritionCardProps {
  title?: string;
  name?: string;
  macros: MacroInput;
  advanced?: FoodAdvancedNutrients;
  /** Show Pro badge when data came from OpenRouter with explicit micro fields */
  proSource?: boolean;
  className?: string;
}

export function AdvancedNutritionCard({
  title,
  name,
  macros,
  advanced,
  proSource = false,
  className = "",
}: AdvancedNutritionCardProps) {
  const { t } = useI18n();
  const showMicro = hasProAccessFromSession();

  const resolved = useMemo(
    () => resolveFoodAdvancedNutrients(macros, advanced),
    [macros, advanced]
  );

  const microRows: {
    key: string;
    label: string;
    value: number;
    unit: string;
    Icon: LucideIcon;
    iconClass: string;
  }[] = [
    {
      key: "fiber",
      label: t("nutritionDash.micro.fiber", "膳食纖維"),
      value: resolved.fiberG,
      unit: "g",
      Icon: Leaf,
      iconClass: "text-emerald-600",
    },
    {
      key: "sugar",
      label: t("nutritionDash.micro.sugar", "糖分"),
      value: resolved.sugarG,
      unit: "g",
      Icon: Cuboid,
      iconClass: "text-amber-600",
    },
    {
      key: "satFat",
      label: t("nutritionDash.micro.satFat", "飽和脂肪"),
      value: resolved.saturatedFatG,
      unit: "g",
      Icon: LineChart,
      iconClass: "text-rose-500",
    },
    {
      key: "sodium",
      label: t("nutritionDash.micro.sodium", "鈉"),
      value: resolved.sodiumMg,
      unit: "mg",
      Icon: Droplets,
      iconClass: "text-sky-600",
    },
    {
      key: "cholesterol",
      label: t("foodSearch.advanced.cholesterol", "膽固醇"),
      value: resolved.cholesterolMg,
      unit: "mg",
      Icon: HeartPulse,
      iconClass: "text-violet-600",
    },
  ];

  return (
    <div
      className={`rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 space-y-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-800">
            <IconLabel icon={BarChart2} size="sm" iconClassName="text-emerald-600">
              {title ?? t("foodSearch.advanced.title", "進階營養分析")}
            </IconLabel>
          </h3>
          {name && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{name}</p>
          )}
        </div>
        {proSource && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
            Pro
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-black text-emerald-700 tabular-nums">
          {macros.calories}
          <span className="text-sm font-semibold text-emerald-600 ml-0.5">kcal</span>
        </span>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {(
            [
              [t("common.protein", "蛋白"), macros.protein, "bg-sky-100 text-sky-800"],
              [t("common.carbs", "碳水"), macros.carbs, "bg-amber-100 text-amber-800"],
              [t("common.fat", "脂肪"), macros.fats, "bg-rose-100 text-rose-800"],
            ] as const
          ).map(([label, val, cls]) => (
            <span
              key={String(label)}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}
            >
              {label} {val}g
            </span>
          ))}
        </div>
      </div>

      {showMicro ? (
        <>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-1 border-t border-zinc-200/80">
            {microRows.map(({ key, label, value, unit, Icon, iconClass }) => (
              <li key={key} className="flex items-center gap-2 min-w-0">
                <Icon
                  size={16}
                  strokeWidth={2}
                  className={`shrink-0 ${iconClass}`}
                  aria-hidden
                />
                <span className="text-xs text-zinc-500 truncate flex-1">
                  {label}
                </span>
                <span className="text-xs font-semibold text-zinc-600 tabular-nums shrink-0">
                  {value}
                  <span className="font-normal text-zinc-400 ml-0.5">
                    {unit}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            {t(
              "foodSearch.advanced.disclaimer",
              "進階營養素由 AI 估算或依宏量推算，僅供 Pro 參考，非醫療建議。"
            )}
          </p>
        </>
      ) : (
        <ProUpgradePrompt
          feature={t("nutritionDash.micro.title", "微營養數據")}
          className="mt-1"
        />
      )}
    </div>
  );
}
