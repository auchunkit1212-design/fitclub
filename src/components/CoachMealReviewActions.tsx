"use client";

import { useEffect, useState } from "react";
import { MEAL_STICKERS } from "@/components/icons";
import { COACH_FEEDBACK_PRESETS } from "@/lib/coach-feedback-presets";
import { errorMessage } from "@/lib/errors";
import {
  COACH_MEAL_RATING_OPTIONS,
  mealRatingButtonClass,
  type CoachMealRatingValue,
} from "@/lib/meal-rating";
import { getSessionRequestHeaders } from "@/lib/session";
import type { MealLog, MealLogRating } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer disabled:opacity-50";

type CoachMealReviewActionsProps = {
  log: MealLog;
  currentRating?: CoachMealRatingValue | null;
  onRated?: (rating: MealLogRating) => void;
  onSent?: (kind: "sticker" | "feedback" | "rating") => void;
  onError?: (message: string) => void;
  compact?: boolean;
};

export function CoachMealReviewActions({
  log,
  currentRating = null,
  onRated,
  onSent,
  onError,
  compact = false,
}: CoachMealReviewActionsProps) {
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [localRating, setLocalRating] = useState<CoachMealRatingValue | null>(
    currentRating
  );

  useEffect(() => {
    setLocalRating(currentRating);
  }, [currentRating, log.id]);

  const activeRating = localRating ?? currentRating ?? null;

  const sendRating = async (rating: CoachMealRatingValue) => {
    setSendingKey(`rating:${rating}`);
    try {
      const res = await fetch("/api/coach/meal-rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          mealLogId: log.id,
          studentEmail: log.email,
          rating,
        }),
      });
      const data = (await res.json()) as { rating?: MealLogRating; error?: string };
      if (!res.ok || !data.rating) {
        onError?.(data.error ?? `評價失敗 (HTTP ${res.status})`);
        return;
      }
      setLocalRating(rating);
      onRated?.(data.rating);
      onSent?.("rating");
    } catch (err) {
      onError?.(errorMessage(err, "評價失敗"));
    } finally {
      setSendingKey(null);
    }
  };

  const sendReaction = async (sticker: string) => {
    setSendingKey(`sticker:${sticker}`);
    try {
      const res = await fetch("/api/coach/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          mealLogId: log.id,
          sticker,
          studentEmail: log.email,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onError?.(data.error ?? `發送失敗 (HTTP ${res.status})`);
        return;
      }
      setSelectedSticker(sticker);
      onSent?.("sticker");
    } catch (err) {
      onError?.(errorMessage(err, "發送失敗"));
    } finally {
      setSendingKey(null);
    }
  };

  const sendFeedback = async (presetKey: string) => {
    setSendingKey(`feedback:${presetKey}`);
    try {
      const res = await fetch("/api/coach/meal-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          mealLogId: log.id,
          studentEmail: log.email,
          presetKey,
          sticker: selectedSticker ?? undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        onError?.(
          data.hint ? `${data.error} — ${data.hint}` : data.error ?? "發送失敗"
        );
        return;
      }
      onSent?.("feedback");
    } catch (err) {
      onError?.(errorMessage(err, "發送失敗"));
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div>
        <p className="text-[10px] text-zinc-500 mb-1.5">評價標籤（由教練評定）</p>
        <div className="flex flex-wrap gap-1.5">
          {COACH_MEAL_RATING_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              disabled={Boolean(sendingKey)}
              onClick={() => void sendRating(value)}
              className={`${mealRatingButtonClass(value, activeRating)} ${btnClass}`}
            >
              {sendingKey === `rating:${value}` ? "…" : label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] text-zinc-500 mb-1.5">貼紙（可選，再揀評語一併送出）</p>
        <div className="flex flex-wrap gap-1.5">
          {MEAL_STICKERS.map(({ id, Icon }) => (
            <button
              key={id}
              type="button"
              disabled={Boolean(sendingKey)}
              onClick={() => void sendReaction(id)}
              className={`px-2 py-1 rounded-lg border ${
                selectedSticker === id
                  ? "bg-amber-100 border-amber-300"
                  : "bg-white border-zinc-200 hover:bg-amber-50"
              } text-amber-800 ${btnClass}`}
              aria-label={id}
              title={id}
            >
              <Icon size={20} strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] text-zinc-500 mb-1.5">預設評語（會推送 App 通知俾學員）</p>
        <div className="flex flex-wrap gap-1.5">
          {COACH_FEEDBACK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={Boolean(sendingKey)}
              onClick={() => void sendFeedback(preset.id)}
              title={preset.message}
              className={`px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-900 text-xs font-medium hover:bg-violet-100 ${btnClass}`}
            >
              {sendingKey === `feedback:${preset.id}` ? "送出中…" : preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
