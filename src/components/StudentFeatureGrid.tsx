"use client";

import { useRouter } from "next/navigation";
import {
  BarChart2,
  Calendar,
  Flame,
  Plus,
  Scale,
  UtensilsCrossed,
} from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";

const btnClass =
  "active:scale-[0.98] active:opacity-85 transition-all cursor-pointer";

type StudentFeatureGridProps = {
  onLogMeal: () => void;
  onOpenNutrition: () => void;
};

export function StudentFeatureGrid({
  onLogMeal,
  onOpenNutrition,
}: StudentFeatureGridProps) {
  const router = useRouter();
  const { t } = useI18n();

  const items = [
    {
      id: "log-meal",
      title: t("home.features.logMeal.title", "記錄飲食"),
      subtitle: t("home.features.logMeal.subtitle", "影相或搜尋，快速打卡"),
      icon: Plus,
      accent: "from-emerald-50 to-teal-50 border-emerald-100",
      iconClass: "text-emerald-700",
      onClick: onLogMeal,
    },
    {
      id: "nutrition",
      title: t("home.features.nutrition.title", "今日營養"),
      subtitle: t("home.features.nutrition.subtitle", "睇熱量、宏量同達標進度"),
      icon: BarChart2,
      accent: "from-violet-50 to-indigo-50 border-violet-100",
      iconClass: "text-violet-700",
      onClick: onOpenNutrition,
    },
    {
      id: "suggest",
      title: t("home.features.suggest.title", "教練！食咩好？"),
      subtitle: t("home.features.suggest.subtitle", "按剩餘宏量建議下一餐"),
      icon: UtensilsCrossed,
      accent: "from-cyan-50 to-sky-50 border-sky-100",
      iconClass: "text-sky-700",
      badge: "AI",
      onClick: () => router.push("/suggest"),
    },
    {
      id: "challenge",
      title: t("home.features.challenge.title", "減脂挑戰賽"),
      subtitle: t("home.features.challenge.subtitle", "每月排行榜，一齊打卡"),
      icon: Flame,
      accent: "from-orange-50 to-amber-50 border-amber-100",
      iconClass: "text-orange-600",
      badge: t("home.features.newBadge", "NEW"),
      onClick: () => router.push("/leaderboard"),
    },
    {
      id: "inbody",
      title: t("home.features.inbody.title", "InBody 分析"),
      subtitle: t("home.features.inbody.subtitle", "影報告，追蹤體脂同肌肉"),
      icon: Scale,
      accent: "from-blue-50 to-cyan-50 border-blue-100",
      iconClass: "text-cyan-700",
      badge: t("home.features.newBadge", "NEW"),
      onClick: () => router.push("/profile#inbody"),
    },
    {
      id: "history",
      title: t("home.features.history.title", "歷史紀錄"),
      subtitle: t("home.features.history.subtitle", "日曆翻查飲食同教練回覆"),
      icon: Calendar,
      accent: "from-rose-50 to-pink-50 border-rose-100",
      iconClass: "text-rose-600",
      onClick: () => router.push("/history"),
    },
  ];

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">
            FitClub tools
          </p>
          <h2 className="mt-0.5 text-lg font-black text-zinc-900">
            {t("home.features.title", "健康工具")}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => router.push("/community")}
          className="text-xs font-bold text-emerald-700 active:opacity-70"
        >
          {t("home.features.exploreAll", "探索全部 →")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative min-h-[9.25rem] overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-4 text-left shadow-[0_8px_24px_rgb(0,0,0,0.04)] ${item.accent} ${btnClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.03]">
                  <Icon
                    size={22}
                    strokeWidth={2.25}
                    className={item.iconClass}
                    aria-hidden
                  />
                </span>
                {item.badge ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-800">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-[15px] font-black leading-snug text-zinc-900">
                {item.title}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                {item.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
