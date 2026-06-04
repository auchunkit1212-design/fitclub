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
      className={`flex flex-col items-center gap-0.5 min-w-[2.5rem] max-w-[3.25rem] ${btnClass}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        size={18}
        strokeWidth={active ? 2.25 : 2}
        className={active ? "text-emerald-600" : "text-zinc-400"}
      />
      <span
        className={`text-[8px] font-semibold leading-tight text-center ${
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

  const communityActive = pathname === "/community";
  const homeActive = pathname === "/";
  const profileActive = pathname === "/profile";
  const settingsActive = pathname === "/settings";

  const handleFab = () => {
    if (onFabClick) {
      onFabClick();
      return;
    }
    if (isStudent) router.push("/add-meal");
    else router.push("/coach/records");
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-3 pointer-events-none">
      <div className="relative pointer-events-auto h-[4.5rem]">
        <nav className="absolute inset-x-0 bottom-0 h-14 flex items-center bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-2 sm:px-3">
          <div className="flex flex-1 items-center justify-evenly min-w-0 pr-7">
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

          <div className="w-11 shrink-0" aria-hidden />

          <div className="flex flex-1 items-center justify-evenly min-w-0 pl-7">
            {isStudent ? (
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
            ) : (
              <NavTabButton
                active={pathname.startsWith("/coach")}
                label={t("nav.coach", "教練")}
                icon={GraduationCap}
                onClick={() => router.push("/coach")}
              />
            )}
          </div>
        </nav>

        <button
          type="button"
          onClick={handleFab}
          aria-label={
            isStudent
              ? t("nav.addMeal", "記錄飲食")
              : t("nav.records", "學員記錄")
          }
          className={`absolute left-1/2 -translate-x-1/2 -top-1 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-lg hover:scale-105 transition-transform ${btnClass}`}
        >
          <Plus size={24} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}
