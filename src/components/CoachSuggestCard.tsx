"use client";

import { useState } from "react";
import { GorillaMascot } from "@/components/GorillaMascot";
import { IconLabel, Loader2, MessageSquare, Sparkles } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { getSessionRequestHeaders } from "@/lib/session";

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
};

export function CoachSuggestCard({
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFats,
  consumedCalories,
  consumedProtein,
  consumedCarbs,
  consumedFats,
}: MacroProps) {
  const { t, lang } = useI18n();
  const [craving, setCraving] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<{
    text: string;
    tags: string[];
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
          craving: craving.trim() || undefined,
          lang,
        }),
      });
      const data = (await res.json()) as {
        suggestion_text?: string;
        tags?: string[];
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
        {t("coachSuggest.subtitle", "Coach! What to eat? — 根據你今日剩餘額度，大猩猩幫你諗下一餐")}
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
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
