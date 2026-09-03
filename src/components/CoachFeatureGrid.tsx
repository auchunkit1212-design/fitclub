"use client";

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

const btnClass =
  "active:scale-[0.98] active:opacity-85 transition-all cursor-pointer";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function CoachFeatureGrid() {
  const router = useRouter();
  const { t } = useI18n();

  const items = [
    {
      id: "students",
      title: t("coachFeatures.students.title", "學員管理"),
      subtitle: t("coachFeatures.students.subtitle", "名單、批閱同每日達標"),
      icon: Users,
      accent: "from-emerald-50 to-teal-50 border-emerald-100",
      iconClass: "text-emerald-700",
      onClick: () => router.push("/coach/students"),
    },
    {
      id: "report",
      title: t("coachFeatures.report.title", "AI 教練報告"),
      subtitle: t("coachFeatures.report.subtitle", "分析學員打卡同營養表現"),
      icon: BarChart2,
      accent: "from-violet-50 to-indigo-50 border-violet-100",
      iconClass: "text-violet-700",
      badge: "AI",
      onClick: () => scrollToSection("coach-report"),
    },
    {
      id: "challenge",
      title: t("coachFeatures.challenge.title", "減脂挑戰榜"),
      subtitle: t("coachFeatures.challenge.subtitle", "睇本月學員排名同分數"),
      icon: Flame,
      accent: "from-orange-50 to-amber-50 border-amber-100",
      iconClass: "text-orange-600",
      badge: t("coachFeatures.newBadge", "NEW"),
      onClick: () => router.push("/leaderboard"),
    },
    {
      id: "invite",
      title: t("coachFeatures.invite.title", "邀請學員"),
      subtitle: t("coachFeatures.invite.subtitle", "複製邀請碼同註冊連結"),
      icon: Ticket,
      accent: "from-cyan-50 to-sky-50 border-sky-100",
      iconClass: "text-sky-700",
      onClick: () => scrollToSection("coach-invite"),
    },
    {
      id: "branding",
      title: t("coachFeatures.branding.title", "品牌同廣播"),
      subtitle: t("coachFeatures.branding.subtitle", "Logo、主題色同學員公告"),
      icon: Palette,
      accent: "from-rose-50 to-pink-50 border-rose-100",
      iconClass: "text-rose-600",
      onClick: () => scrollToSection("coach-branding"),
    },
    {
      id: "notifications",
      title: t("coachFeatures.notifications.title", "推播通知"),
      subtitle: t("coachFeatures.notifications.subtitle", "接收學員打卡即時通知"),
      icon: Bell,
      accent: "from-blue-50 to-indigo-50 border-blue-100",
      iconClass: "text-blue-700",
      onClick: () => scrollToSection("coach-notifications"),
    },
    {
      id: "meals",
      title: t("coachFeatures.meals.title", "我的飲食"),
      subtitle: t("coachFeatures.meals.subtitle", "查看教練自己嘅飲食記錄"),
      icon: UtensilsCrossed,
      accent: "from-lime-50 to-green-50 border-lime-100",
      iconClass: "text-lime-700",
      onClick: () => scrollToSection("coach-meals"),
    },
    {
      id: "plan",
      title: t("coachFeatures.plan.title", "Coach Pro"),
      subtitle: t("coachFeatures.plan.subtitle", "管理方案同進階功能"),
      icon: Sparkles,
      accent: "from-yellow-50 to-amber-50 border-yellow-100",
      iconClass: "text-amber-700",
      onClick: () => scrollToSection("coach-plan"),
    },
  ];

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">
            Coach tools
          </p>
          <h2 className="mt-0.5 text-lg font-black text-zinc-900">
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
