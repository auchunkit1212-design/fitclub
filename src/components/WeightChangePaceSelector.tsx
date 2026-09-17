"use client";

import { useI18n } from "@/components/I18nProvider";
import { Target } from "@/components/icons";
import { WEIGHT_CHANGE_PACE_OPTIONS } from "@/lib/body-profile";
import type { WeightChangeKgPerWeek } from "@/lib/types";

type Props = {
  value: WeightChangeKgPerWeek | null;
  onChange: (pace: WeightChangeKgPerWeek) => void;
  compact?: boolean;
};

export function WeightChangePaceSelector({ value, onChange, compact }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
        <Target size={14} className="text-emerald-600 shrink-0" aria-hidden />
        {t("bodyProfile.pace.label", "每週體重目標")}
      </label>
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        {t(
          "bodyProfile.pace.hint",
          "選擇你每週想增重、減重或維持；系統會按此調整每日卡路里目標。"
        )}
      </p>
      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        {WEIGHT_CHANGE_PACE_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`text-left rounded-xl border-2 px-3 py-2.5 transition-all active:scale-[0.98] ${
                selected
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <span className="text-sm font-semibold">
                {t(opt.i18nKey, opt.fallback)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
