"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  Bell,
  ChevronRight,
  Flame,
  Palette,
  Sparkles,
  Ticket,
  Users,
  UtensilsCrossed,
} from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { prefetchCoachInbox } from "@/lib/coach-inbox-client";

const btnClass =
  "active:scale-[0.98] active:opacity-85 transition-all cursor-pointer";

export function CoachFeatureGrid() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    for (const route of [
      "/coach/students",
      "/coach",
      "/leaderboard",
      "/community",
    ]) {
      router.prefetch(route);
    }
    void prefetchCoachInbox();
  }, [router]);

  const items = [
    {
      id: "students",
      title: t("coachFeatures.students.title", "學員管理"),
      subtitle: t("coachFeatures.students.subtitle", "名單、批閱同每日達標"),
      icon: Users,
      onClick: () => router.push("/coach/students"),
    },
    {
      id: "report",
      title: t("coachFeatures.report.title", "AI 教練報告"),
      subtitle: t("coachFeatures.report.subtitle", "分析學員打卡同營養表現"),
      icon: BarChart2,
      badge: "AI",
      onClick: () => router.push("/coach#coach-report"),
    },
    {
      id: "challenge",
      title: t("coachFeatures.challenge.title", "減脂挑戰榜"),
      subtitle: t("coachFeatures.challenge.subtitle", "睇本月學員排名同分數"),
      icon: Flame,
      onClick: () => router.push("/leaderboard"),
    },
    {
      id: "invite",
      title: t("coachFeatures.invite.title", "邀請學員"),
      subtitle: t("coachFeatures.invite.subtitle", "複製邀請碼同註冊連結"),
      icon: Ticket,
      onClick: () => router.push("/coach#coach-invite"),
    },
    {
      id: "branding",
      title: t("coachFeatures.branding.title", "品牌同廣播"),
      subtitle: t("coachFeatures.branding.subtitle", "Logo、主題色同學員公告"),
      icon: Palette,
      onClick: () => router.push("/coach#coach-branding"),
    },
    {
      id: "notifications",
      title: t("coachFeatures.notifications.title", "推播通知"),
      subtitle: t("coachFeatures.notifications.subtitle", "接收學員打卡即時通知"),
      icon: Bell,
      onClick: () => router.push("/coach#coach-notifications"),
    },
    {
      id: "meals",
      title: t("coachFeatures.meals.title", "我的飲食"),
      subtitle: t("coachFeatures.meals.subtitle", "查看教練自己嘅飲食記錄"),
      icon: UtensilsCrossed,
      onClick: () => router.push("/coach#coach-meals"),
    },
    {
      id: "plan",
      title: t("coachFeatures.plan.title", "Coach Pro"),
      subtitle: t("coachFeatures.plan.subtitle", "管理方案同進階功能"),
      icon: Sparkles,
      onClick: () => router.push("/coach#coach-plan"),
    },
  ];

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 className="text-base font-semibold text-gray-900">
          {t("coachFeatures.title", "教練工具")}
        </h2>
        <button
          type="button"
          onClick={() => router.push("/community")}
          className="text-xs font-medium text-gray-500 active:opacity-70"
        >
          {t("coachFeatures.explore", "探索")}
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] divide-y divide-zinc-100">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${btnClass}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
                <Icon
                  size={18}
                  strokeWidth={2}
                  className="text-emerald-700"
                  aria-hidden
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {item.title}
                  </span>
                  {item.badge ? (
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">
                  {item.subtitle}
                </span>
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-gray-300"
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
