"use client";

import { MealStickerIcon } from "@/components/icons";
import { isValidSticker } from "@/lib/meal-stickers";
import { mealRatingBadgeStyle, mealRatingLabel } from "@/lib/meal-rating";
import type { CoachMealRatingValue } from "@/lib/meal-rating";
import type { MealLogFeedback, MealLogReaction } from "@/lib/types";

type CoachFeedbackDisplayProps = {
  reaction?: MealLogReaction;
  feedback?: MealLogFeedback;
  rating?: CoachMealRatingValue | null;
  className?: string;
};

export function CoachFeedbackDisplay({
  reaction,
  feedback,
  rating = null,
  className = "",
}: CoachFeedbackDisplayProps) {
  if (!reaction && !feedback && !rating) return null;

  const sticker = feedback?.sticker ?? reaction?.sticker;
  const showSticker = sticker && isValidSticker(sticker);

  return (
    <div
      className={`text-xs text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2 space-y-1 ${className}`}
    >
      <p className="font-medium flex items-center gap-1.5 flex-wrap">
        教練回覆咗你
        {rating ? (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${mealRatingBadgeStyle(rating)}`}
          >
            {mealRatingLabel(rating)}
          </span>
        ) : null}
        {showSticker && (
          <MealStickerIcon sticker={sticker} size="sm" className="text-violet-700" />
        )}
      </p>
      {feedback?.messageText && (
        <p className="text-violet-900 leading-relaxed">「{feedback.messageText}」</p>
      )}
    </div>
  );
}
