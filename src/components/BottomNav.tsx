"use client";

import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import {
  CircleUser,
  Globe,
  GraduationCap,
  Home,
  Plus,
  Settings,
  Users,
} from "@/components/icons";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface BottomNavProps {
  role: "student" | "coach" | "admin";
  onFabClick?: () => void;
}

function NavTabButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Home;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 max-w-[4.5rem] py-1 ${btnClass}`}
      aria-current={active ? "page" : undefined}
      aria-label={label}
    >
      <Icon
        size={18}
        strokeWidth={active ? 2.25 : 2}
        className={`shrink-0 ${active ? "text-emerald-600" : "text-zinc-400"}`}
      />
      <span
        className={`text-[7px] leading-none font-semibold text-center ${
          active ? "text-emerald-600" : "text-zinc-400"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function BottomNav({ role, onFabClick }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const isStudent = role === "student";
  const isCoachOrAdmin = role === "coach" || role === "admin";

  const communityActive = pathname === "/community";
  const homeActive = pathname === "/";
  const profileActive = pathname === "/profile";
  const settingsActive = pathname === "/settings";
  const studentsActive =
    pathname.startsWith("/coach/students") ||
    pathname.startsWith("/coach/records");
  const coachActive = pathname === "/coach";

  const handleFab = () => {
    if (onFabClick) {
      onFabClick();
      return;
    }
    if (isStudent) router.push("/add-meal");
    else router.push("/coach/students");
  };

  const rightTabs = isStudent ? (
    <>
      <NavTabButton
        active={profileActive}
        label={t("nav.profile", "我的")}
        icon={CircleUser}
        onClick={() => router.push("/profile")}
      />
      <NavTabButton
        active={settingsActive}
        label={t("nav.settings", "設定")}
        icon={Settings}
        onClick={() => router.push("/settings")}
      />
    </>
  ) : isCoachOrAdmin ? (
    <>
      <NavTabButton
        active={studentsActive}
        label={t("nav.students", "學員")}
        icon={Users}
        onClick={() => router.push("/coach/students")}
      />
      <NavTabButton
        active={coachActive}
        label={t("nav.coach", "教練")}
        icon={GraduationCap}
        onClick={() => router.push("/coach")}
      />
    </>
  ) : null;

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(100%,24rem)] px-2 pointer-events-none">
      <div className="relative pointer-events-auto">
        <nav
          className="flex items-end h-14 rounded-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-1"
          aria-label={t("nav.main", "主導覽")}
        >
          <div className="flex flex-1 items-end justify-around min-w-0 pr-1">
            <NavTabButton
              active={communityActive}
              label={t("nav.explore", "探索")}
              icon={Globe}
              onClick={() => router.push("/community")}
            />
            <NavTabButton
              active={homeActive}
              label={t("nav.home", "主頁")}
              icon={Home}
              onClick={() => router.push("/")}
            />
          </div>

          <div className="w-14 shrink-0" aria-hidden />

          <div className="flex flex-1 items-end justify-around min-w-0 pl-1">
            {rightTabs}
          </div>
        </nav>

        <button
          type="button"
          onClick={handleFab}
          aria-label={
            isStudent
              ? t("nav.addMeal", "記錄飲食")
              : t("nav.students", "學員")
          }
          className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1 bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-full shadow-lg ${btnClass}`}
        >
          <Plus size={22} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}
