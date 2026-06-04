"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { GraduationCap, Home, Plus, Settings } from "@/components/icons";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type ActiveTab = "dashboard" | "settings";

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  role: "student" | "coach" | "admin";
  onFabClick?: () => void;
}

export function BottomNav({
  activeTab,
  onTabChange,
  role,
  onFabClick,
}: BottomNavProps) {
  const router = useRouter();
  const { t } = useI18n();
  const isStudent = role === "student";

  const handleFab = () => {
    if (onFabClick) {
      onFabClick();
      return;
    }
    if (isStudent) router.push("/add-meal");
    else router.push("/coach/records");
  };

  const homeActive = activeTab === "dashboard";
  const settingsActive = activeTab === "settings";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
      <div className="relative pointer-events-auto h-[4.5rem]">
        <nav className="absolute inset-x-0 bottom-0 h-14 flex items-center justify-between bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-6 sm:px-10">
          <button
            type="button"
            onClick={() => onTabChange("dashboard")}
            className={`flex flex-col items-center gap-0.5 min-w-[3rem] ${btnClass}`}
            aria-current={homeActive ? "page" : undefined}
          >
            <Home
              size={22}
              strokeWidth={homeActive ? 2.25 : 2}
              className={
                homeActive ? "text-emerald-600" : "text-zinc-400"
              }
            />
            <span
              className={`text-[10px] font-semibold ${
                homeActive ? "text-emerald-600" : "text-zinc-400"
              }`}
            >
              {t("nav.home", "主頁")}
            </span>
          </button>

          <div className="w-14 shrink-0" aria-hidden />

          {isStudent ? (
            <button
              type="button"
              onClick={() => onTabChange("settings")}
              className={`flex flex-col items-center gap-0.5 min-w-[3rem] ${btnClass}`}
              aria-current={settingsActive ? "page" : undefined}
            >
              <Settings
                size={22}
                strokeWidth={settingsActive ? 2.25 : 2}
                className={
                  settingsActive ? "text-emerald-600" : "text-zinc-400"
                }
              />
              <span
                className={`text-[10px] font-semibold ${
                  settingsActive ? "text-emerald-600" : "text-zinc-400"
                }`}
              >
                {t("nav.settings", "設定")}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/coach")}
              className={`flex flex-col items-center gap-0.5 min-w-[3rem] ${btnClass}`}
            >
              <GraduationCap size={22} className="text-zinc-400" />
              <span className="text-[10px] font-semibold text-zinc-400">
                {t("nav.coach", "教練")}
              </span>
            </button>
          )}
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
