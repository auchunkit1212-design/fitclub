"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  Bell,
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
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("coachFeatures.title", "教練工具")}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => router.push("/community")}
          className="text-xs font-bold text-emerald-700 active:opacity-70"
        >
          {t("coachFeatures.explore", "探索更多 →")}
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
              className={`relative min-h-[8.5rem] overflow-hidden rounded-3xl bg-white p-4 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${btnClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50">
                  <Icon
                    size={20}
                    strokeWidth={2}
                    className="text-emerald-700"
                    aria-hidden
                  />
                </span>
                {item.badge ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-[15px] font-semibold leading-snug text-gray-900">
                {item.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                {item.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
