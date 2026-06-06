"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FoodSearchEngine } from "@/components/FoodSearchEngine";
import { useI18n } from "@/components/I18nProvider";
import { Camera, IconLabel } from "@/components/icons";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface MealSearchSheetProps {
  open: boolean;
  onClose: () => void;
  onAddToMeal: (item: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    fromSearch: boolean;
    nutritionSource?: import("@/lib/meal-ai-verify").MealBaselineSource;
    advanced?: import("@/lib/types").FoodAdvancedNutrients;
  }) => void;
}

export function MealSearchSheet({
  open,
  onClose,
  onAddToMeal,
}: MealSearchSheetProps) {
  const router = useRouter();
  const { t } = useI18n();

  const goToFullLog = () => {
    onClose();
    router.push("/add-meal");
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        aria-label={t("common.close", "關閉")}
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md mx-auto bg-white rounded-t-3xl shadow-[0_-12px_40px_rgb(0,0,0,0.12)] px-4 pt-3 pb-8 pb-safe max-h-[88vh] overflow-y-auto scrollbar-hide"
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {t("foodSearch.sheetTitle", "快速記錄飲食")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-lg leading-none ${btnClass}`}
          >
            ×
          </button>
        </div>
        <FoodSearchEngine embedded onAddToMeal={onAddToMeal} />
        <button
          type="button"
          onClick={goToFullLog}
          className={`w-full mt-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-gray-800 text-sm font-semibold ${btnClass}`}
        >
          <IconLabel icon={Camera} iconClassName="text-gray-600">
            {t("foodSearch.fullLogCta", "完整記錄（含相片）")}
          </IconLabel>
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          {t(
            "foodSearch.sheetHint",
            "選擇食物後會自動記錄；需要相片或詳細設定請用完整記錄頁"
          )}
        </p>
      </div>
    </div>
  );
}
