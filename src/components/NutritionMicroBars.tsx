"use client";

import { useI18n } from "@/components/I18nProvider";
import { estimateMicronutrients } from "@/lib/body-profile";
import { getRecommendedMicronutrientTargets } from "@/lib/micronutrient-targets";

export function MicroBar({
  label,
  current,
  target,
  unit,
  color,
  mode = "min",
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
  /** min: 越高越好（如纖維）；max: 越低越好（如鈉、糖） */
  mode?: "min" | "max";
}) {
  const pct =
    mode === "max"
      ? Math.min(100, Math.round((current / target) * 100)) || 0
      : Math.min(100, Math.round((current / target) * 100)) || 0;
  const barColor =
    mode === "max" && current > target ? "bg-orange-500" : color;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500">
          {current}
          {unit}
          {mode === "max" ? " / ≤" : " / "}
          {target}
          {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type MicronutrientGuideProps = {
  calories: number;
  carbs: number;
  fats: number;
  protein: number;
  targetCalories: number;
  targetCarbs?: number;
  targetFats?: number;
  weightKg?: number;
  showRecommendationsTable?: boolean;
};

export function MicronutrientGuideSection({
  calories,
  carbs,
  fats,
  protein,
  targetCalories,
  targetCarbs,
  targetFats,
  weightKg,
  showRecommendationsTable = true,
}: MicronutrientGuideProps) {
  const { t } = useI18n();
  const micro = estimateMicronutrients(calories, carbs, fats, protein);
  const targets = getRecommendedMicronutrientTargets({
    targetCalories,
    targetCarbs,
    targetFats,
    weightKg,
  });

  const rows = [
    {
      label: t("nutritionDash.micro.fiber", "膳食纖維"),
      recommend: `≥${targets.fiberGMin}g`,
      mode: "min" as const,
      current: micro.fiberG,
      target: targets.fiberGMin,
      unit: "g",
      color: "bg-emerald-500",
    },
    {
      label: t("nutritionDash.micro.sugar", "糖分"),
      recommend: `≤${targets.sugarGMax}g`,
      mode: "max" as const,
      current: micro.sugarG,
      target: targets.sugarGMax,
      unit: "g",
      color: "bg-amber-500",
    },
    {
      label: t("nutritionDash.micro.satFat", "飽和脂肪"),
      recommend: `≤${targets.saturatedFatGMax}g`,
      mode: "max" as const,
      current: micro.satFatG,
      target: targets.saturatedFatGMax,
      unit: "g",
      color: "bg-red-500",
    },
    {
      label: t("nutritionDash.micro.sodium", "鈉"),
      recommend: `≤${targets.sodiumMgMax}mg`,
      mode: "max" as const,
      current: micro.sodiumMg,
      target: targets.sodiumMgMax,
      unit: "mg",
      color: "bg-blue-500",
    },
    {
      label: t("microGuide.cholesterol", "膽固醇"),
      recommend: `≤${targets.cholesterolMgMax}mg`,
      mode: "max" as const,
      current: micro.cholesterolMg,
      target: targets.cholesterolMgMax,
      unit: "mg",
      color: "bg-violet-500",
    },
  ];

  return (
    <div className="space-y-4">
      {showRecommendationsTable && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 overflow-hidden">
          <p className="text-xs font-semibold text-emerald-800 px-3 py-2 border-b border-emerald-100">
            {t("microGuide.recommendedDaily", "建議每日攝取量")}
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="text-left font-medium px-3 py-1.5">
                  {t("microGuide.nutrient", "營養素")}
                </th>
                <th className="text-right font-medium px-3 py-1.5">
                  {t("microGuide.recommend", "建議")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-emerald-100/80">
                  <td className="px-3 py-1.5 text-zinc-800">{r.label}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-emerald-800">
                    {r.recommend}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold text-zinc-700">
          {t("microGuide.todayVsRecommend", "今日攝取 vs 建議")}
        </p>
        {rows.map((r) => (
          <MicroBar
            key={r.label}
            label={r.label}
            current={r.current}
            target={r.target}
            unit={r.unit}
            color={r.color}
            mode={r.mode}
          />
        ))}
        <p className="text-[10px] text-zinc-400">
          {t(
            "nutritionDash.micro.disclaimer",
            "* 微量元素由今日總攝取估算，僅供參考"
          )}
        </p>
      </div>
    </div>
  );
}
