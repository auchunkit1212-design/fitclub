"use client";

import Image from "next/image";
import { Bot } from "@/components/icons";
import { APP_LOGO_PATH } from "@/lib/brand";
import { useI18n } from "@/components/I18nProvider";
import { getMealImageSrc } from "@/lib/meal-display";
import { isValidSticker } from "@/lib/meal-stickers";
import type { HistoryDayDetail as DayDetail } from "@/lib/history-calendar";
import { CoachFeedbackDisplay } from "@/components/CoachFeedbackDisplay";
import type { MealLogFeedback, MealLogReaction } from "@/lib/types";

const SOFT_CARD =
  "rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

function MacroBar({
  label,
  current,
  target,
  unit,
  colorClass,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  colorClass: string;
}) {
  const pct = Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="text-gray-500 tabular-nums">
          {Math.round(current)}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 text-right">{pct}%</p>
    </div>
  );
}

export function HistoryDayDetailPanel({
  detail,
  loading,
}: {
  detail: DayDetail | null;
  loading: boolean;
}) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className={`${SOFT_CARD} p-6 text-center text-sm text-gray-400`}>
        {t("history.day.loading", "載入當日紀錄…")}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={`${SOFT_CARD} p-6 text-center text-sm text-gray-400`}>
        {t("history.day.pickDate", "點選日曆上的日期以查看詳情")}
      </div>
    );
  }

  const stickerReactions = detail.reactions.filter((r) =>
    isValidSticker(r.sticker)
  );
  const hasContent =
    detail.meals.length > 0 ||
    detail.aiReviews.length > 0 ||
    stickerReactions.length > 0;

  if (!hasContent) {
    return (
      <div className={`${SOFT_CARD} p-6 text-center`}>
        <p className="text-sm font-medium text-gray-700">
          {t("history.day.noLogs", "這天沒有飲食紀錄")}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {detail.date}
        </p>
      </div>
    );
  }

  return (
    <div className={`${SOFT_CARD} p-5 space-y-5`}>
      <div>
        <h3 className="text-base font-bold text-gray-900">
          {t("history.day.title", "{date} 詳情", { date: detail.date })}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {t("history.day.mealCount", "共 {count} 餐", {
            count: detail.meals.length,
          })}
          {" · "}
          {detail.totals.calories} kcal
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {t("history.day.macros", "P / C / F 達成率")}
        </p>
        <MacroBar
          label={t("common.protein", "蛋白")}
          current={detail.totals.protein}
          target={detail.targets.targetProtein}
          unit="g"
          colorClass="bg-sky-500"
        />
        <MacroBar
          label={t("common.carbs", "碳水")}
          current={detail.totals.carbs}
          target={detail.targets.targetCarbs}
          unit="g"
          colorClass="bg-amber-500"
        />
        <MacroBar
          label={t("common.fat", "脂肪")}
          current={detail.totals.fats}
          target={detail.targets.targetFats}
          unit="g"
          colorClass="bg-rose-400"
        />
      </div>

      {detail.meals.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {t("history.day.meals", "飲食清單")}
          </p>
          <ul className="space-y-2.5">
            {detail.meals.map((meal) => {
              const img = getMealImageSrc(meal);
              const mealReaction = detail.reactions.find(
                (r) => r.mealLogId === meal.id
              );
              const mealFeedback = detail.feedback.find(
                (f) => f.mealLogId === meal.id
              );
              return (
                <li
                  key={meal.id}
                  className="flex gap-3 p-3 rounded-2xl bg-gray-50/80"
                >
                  <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                    {img ? (
                      <Image
                        src={img}
                        alt=""
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {meal.mealType} · {meal.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {meal.calories} kcal · P{meal.protein} C{meal.carbs} F
                      {meal.fats}
                    </p>
                    {(mealReaction || mealFeedback) && (
                      <CoachFeedbackDisplay
                        reaction={mealReaction}
                        feedback={mealFeedback}
                        className="mt-1"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {detail.aiReviews.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
            <Bot size={16} className="text-emerald-600" />
            {t("history.day.aiReviews", "大猩猩 AI 點評")}
          </p>
          <ul className="space-y-2.5">
            {detail.aiReviews.map((review) => (
              <li
                key={`${review.mealLogId}-${review.createdAt}`}
                className="flex gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-[#ecfdf5] to-white"
              >
                <img
                  src={APP_LOGO_PATH}
                  alt=""
                  className="w-8 h-8 rounded-full shrink-0 object-cover"
                />
                <p className="text-sm leading-relaxed text-gray-700">
                  {review.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
