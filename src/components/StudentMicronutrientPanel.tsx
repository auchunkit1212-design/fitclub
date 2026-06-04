"use client";

import { MicronutrientGuideSection } from "@/components/NutritionMicroBars";
import { useI18n } from "@/components/I18nProvider";
import { IconLabel, Leaf } from "@/components/icons";

const SOFT_CARD =
  "bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100";

type Props = {
  todayCalories: number;
  todayCarbs: number;
  todayFats: number;
  todayProtein: number;
  targetCalories: number;
  targetCarbs?: number;
  targetFats?: number;
  weightKg?: number;
};

export function StudentMicronutrientPanel({
  todayCalories,
  todayCarbs,
  todayFats,
  todayProtein,
  targetCalories,
  targetCarbs,
  targetFats,
  weightKg,
}: Props) {
  const { t } = useI18n();

  return (
    <section className={`${SOFT_CARD} p-5 space-y-3`}>
      <h2 className="font-semibold text-gray-900">
        <IconLabel icon={Leaf} iconClassName="text-emerald-600">
          {t("microGuide.title", "進階營養素指南")}
        </IconLabel>
      </h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        {t(
          "microGuide.subtitle",
          "除熱量同三大營養素外，參考建議攝取量檢視膳食纖維、糖、鈉等今日估算攝取。"
        )}
      </p>
      <MicronutrientGuideSection
        calories={todayCalories}
        carbs={todayCarbs}
        fats={todayFats}
        protein={todayProtein}
        targetCalories={targetCalories}
        targetCarbs={targetCarbs}
        targetFats={targetFats}
        weightKg={weightKg}
      />
    </section>
  );
}
