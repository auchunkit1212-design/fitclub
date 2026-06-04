"use client";

import { GorillaMascot } from "@/components/GorillaMascot";
import { Flame, Sparkles } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import type { StreakMilestoneDay } from "@/lib/streak";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface StreakMilestoneModalProps {
  days: StreakMilestoneDay;
  onClose: () => void;
}

export function StreakMilestoneModal({ days, onClose }: StreakMilestoneModalProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-milestone-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-[0_24px_80px_rgb(0,0,0,0.18)] p-8 text-center space-y-5">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-emerald-100 flex items-center justify-center">
              <Flame
                size={40}
                strokeWidth={2}
                className="text-orange-500 fill-orange-400"
                aria-hidden
              />
            </div>
            <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {days}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p
            id="streak-milestone-title"
            className="text-xl font-bold text-zinc-900 leading-snug"
          >
            {t("streak.milestone.title", "震撼！連續 {days} 天健康打卡", {
              days,
            })}
          </p>
          <p className="text-sm text-zinc-600 leading-relaxed">
            {t(
              "streak.milestone.body",
              "大猩猩為你的自律點讚！你已經超越了 90% 正在減脂的學員，繼續保持！"
            )}
          </p>
        </div>

        <div className="flex justify-center">
          <GorillaMascot size="md" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-[0_8px_30px_rgb(5,150,105,0.35)] ${btnClass}`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Sparkles size={18} strokeWidth={2} className="text-white" aria-hidden />
            {t("streak.milestone.cta", "繼續努力")}
          </span>
        </button>
      </div>
    </div>
  );
}
