"use client";

import { useState } from "react";
import { GorillaMascot } from "@/components/GorillaMascot";
import {
  IconLabel,
  Loader2,
  MessageSquare,
  ScrollText,
  Sparkles,
} from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { getSessionRequestHeaders } from "@/lib/session";
import type { RestOfDayMeal } from "@/lib/coach-suggest";

const SOFT_CARD =
  "w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]";
const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type MacroProps = {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFats: number;
  mealsLoggedToday?: number;
};

function MealPlanList({
  meals,
  mode,
}: {
  meals: RestOfDayMeal[];
  mode: "craving_plus_plan" | "full_day_plan";
}) {
  const { t } = useI18n();
  if (meals.length === 0) return null;

  const title =
    mode === "full_day_plan"
      ? t("coachSuggest.fullDayPlan", "全日飲食建議")
      : t("coachSuggest.restOfDayPlan", "食完之後，今日仲可以食");

  return (
    <div className="mt-4 space-y-2.5">
      <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 pl-1">
        <ScrollText size={14} className="text-emerald-600 shrink-0" />
        {title}
      </p>
      <ul className="space-y-2">
        {meals.map((meal, i) => (
          <li
            key={`${meal.slot}-${meal.title}-${i}`}
            className="rounded-2xl bg-white border border-emerald-100/80 px-3.5 py-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                {meal.slot}
              </span>
              {(meal.estimated_calories ?? 0) > 0 && (
                <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                  ~{meal.estimated_calories} kcal
                  {meal.protein_g ? ` · P${meal.protein_g}g` : ""}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-2">{meal.title}</p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              {meal.description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CoachSuggestCard({
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFats,
  consumedCalories,
  consumedProtein,
  consumedCarbs,
  consumedFats,
  mealsLoggedToday = 0,
}: MacroProps) {
  const { t, lang } = useI18n();
  const [craving, setCraving] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<{
    text: string;
    tags: string[];
    restOfDayMeals: RestOfDayMeal[];
    mode: "craving_plus_plan" | "full_day_plan";
  } | null>(null);

  const handleAsk = async () => {
    setLoading(true);
    setError("");
    setSuggestion(null);
    try {
      const res = await fetch("/api/coach-suggest", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        body: JSON.stringify({
          targetCalories,
          targetProtein,
          targetCarbs,
          targetFats,
          consumedCalories,
          consumedProtein,
          consumedCarbs,
          consumedFats,
          mealsLoggedToday,
          craving: craving.trim() || undefined,
          lang,
        }),
      });
      const data = (await res.json()) as {
        suggestion_text?: string;
        tags?: string[];
        rest_of_day_meals?: RestOfDayMeal[];
        mode?: "craving_plus_plan" | "full_day_plan";
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? t("coachSuggest.error", "教練暫時忙緊，請稍後再試"));
        return;
      }
      if (!data.suggestion_text?.trim()) {
        setError(t("coachSuggest.empty", "教練冇回覆，請再試一次"));
        return;
      }
      setSuggestion({
        text: data.suggestion_text.trim(),
        tags: data.tags ?? [],
        restOfDayMeals: data.rest_of_day_meals ?? [],
        mode: data.mode ?? (craving.trim() ? "craving_plus_plan" : "full_day_plan"),
      });
    } catch {
      setError(t("coachSuggest.error", "教練暫時忙緊，請稍後再試"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className={`${SOFT_CARD} p-5 space-y-4 ring-1 ring-emerald-600/15 bg-gradient-to-br from-white to-[#ecfdf5]/40`}
    >
      <h2 className="font-bold text-gray-900 text-base">
        <IconLabel icon={MessageSquare} iconClassName="text-emerald-600">
          {t("coachSuggest.title", "問問教練")}
        </IconLabel>
      </h2>
      <p className="text-xs text-gray-500 -mt-2">
        {t(
          "coachSuggest.subtitle",
          "Coach! What to eat? — 根據你今日剩餘額度，大猩猩幫你諗下一餐同埋剩餘餐單"
        )}
      </p>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-gray-600">
          {t("coachSuggest.cravingLabel", "你下一餐想吃什麼種類？")}
        </span>
        <input
          type="text"
          value={craving}
          onChange={(e) => setCraving(e.target.value)}
          placeholder={t(
            "coachSuggest.cravingPlaceholder",
            "例如：日式、快餐、茶餐廳，或留空讓教練決定"
          )}
          maxLength={80}
          className="w-full rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </label>

      <button
        type="button"
        onClick={() => void handleAsk()}
        disabled={loading}
        className={`w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-bold py-4 rounded-3xl shadow-[0_8px_30px_rgb(5,150,105,0.3)] flex items-center justify-center gap-2 ${btnClass}`}
      >
        {loading ? (
          <>
            <Loader2 size={20} className="animate-spin" aria-hidden />
            {t("coachSuggest.loading", "大猩猩諗緊…")}
          </>
        ) : (
          <>
            <Sparkles size={20} strokeWidth={2.25} aria-hidden />
            {t("coachSuggest.cta", "Coach! What to eat?")}
          </>
        )}
      </button>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {suggestion && (
        <div className="relative pt-2">
          <div className="flex gap-3 items-start">
            <GorillaMascot size="sm" className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="rounded-3xl rounded-tl-lg bg-[#ecfdf5] px-4 py-3.5 shadow-sm">
                <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                  {suggestion.text}
                </p>
              </div>
              {suggestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 pl-1">
                  {suggestion.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <MealPlanList
                meals={suggestion.restOfDayMeals}
                mode={suggestion.mode}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
