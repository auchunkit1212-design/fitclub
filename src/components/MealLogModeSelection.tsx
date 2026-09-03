"use client";

import { useI18n } from "@/components/I18nProvider";
import { Barcode, Salad, Sparkles } from "@/components/icons";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export type MealLogEntryMode = "cooked" | "packaged";

type Props = {
  onSelect: (mode: MealLogEntryMode) => void;
  className?: string;
};

export function MealLogModeSelection({ onSelect, className = "" }: Props) {
  const { t } = useI18n();

  return (
    <div
      className={`space-y-4 animate-fade-slide-in ${className}`}
      role="group"
      aria-label={t("addMeal.modeSelect.title", "點樣記錄呢餐？")}
    >
      <div className="space-y-1.5 px-0.5">
        <h2 className="text-xl font-bold text-zinc-900">
          {t("addMeal.modeSelect.title", "點樣記錄呢餐？")}
        </h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          {t(
            "addMeal.modeSelect.subtitle",
            "揀適合嘅方式，包裝食物用 AI 掃描會更快更準。"
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onSelect("cooked")}
        className={`w-full text-left rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-emerald-300 hover:bg-emerald-50/40 ${btnClass}`}
      >
        <div className="flex items-start gap-4">
          <span className="shrink-0 w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Salad size={28} strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block text-base font-bold text-zinc-900">
              {t("addMeal.modeSelect.cookedTitle", "已經煮好 / 外食")}
            </span>
            <span className="block text-sm text-zinc-500 leading-relaxed">
              {t(
                "addMeal.modeSelect.cookedHint",
                "茶餐廳、住家飯。支援拍照及文字搜尋。"
              )}
            </span>
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("packaged")}
        className={`relative w-full text-left rounded-3xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-[0_8px_30px_rgb(5,150,105,0.12)] hover:border-emerald-500 ${btnClass}`}
      >
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">
          <Sparkles size={12} aria-hidden />
          {t("addMeal.modeSelect.recommended", "推薦使用")}
        </span>
        <div className="flex items-start gap-4 pr-16">
          <span className="shrink-0 w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Barcode size={28} strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block text-base font-bold text-zinc-900">
              {t("addMeal.modeSelect.packagedTitle", "包裝食物 / 飲品")}
            </span>
            <span className="block text-sm text-zinc-600 leading-relaxed">
              {t(
                "addMeal.modeSelect.packagedHint",
                "使用 AI 掃描背後營養標籤。"
              )}
            </span>
          </span>
        </div>
      </button>
    </div>
  );
}
