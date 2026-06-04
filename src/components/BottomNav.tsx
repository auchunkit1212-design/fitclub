"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

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

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
      <div className="relative pointer-events-auto h-[4.5rem]">
        <nav className="absolute inset-x-0 bottom-0 h-14 flex items-center justify-between bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-6 sm:px-10">
          <button
            type="button"
            onClick={() => onTabChange("dashboard")}
            className={`flex flex-col items-center gap-0.5 min-w-[3rem] ${btnClass}`}
            aria-current={activeTab === "dashboard" ? "page" : undefined}
          >
            <span
              className={`text-xl leading-none ${
                activeTab === "dashboard" ? "opacity-100" : "opacity-50"
              }`}
            >
              🏠
            </span>
            <span
              className={`text-[10px] font-semibold ${
                activeTab === "dashboard"
                  ? "text-emerald-600"
                  : "text-gray-500"
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
              aria-current={activeTab === "settings" ? "page" : undefined}
            >
              <span
                className={`text-xl leading-none ${
                  activeTab === "settings" ? "opacity-100" : "opacity-50"
                }`}
              >
                ⚙️
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  activeTab === "settings"
                    ? "text-emerald-600"
                    : "text-gray-500"
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
              <span className="text-xl leading-none">👨‍🏫</span>
              <span className="text-[10px] font-semibold text-gray-500">
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
          <span className="text-2xl font-light leading-none block w-6 h-6 text-center">
            +
          </span>
        </button>
      </div>
    </div>
  );
}
