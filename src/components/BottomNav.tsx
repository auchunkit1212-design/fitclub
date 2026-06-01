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
  themeBtn: string;
}

export function BottomNav({
  activeTab,
  onTabChange,
  role,
  themeBtn,
}: BottomNavProps) {
  const router = useRouter();
  const { t } = useI18n();
  const isStudent = role === "student";

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 px-4 pt-3 pb-safe shadow-sm">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onTabChange("dashboard")}
          className={`${
            activeTab === "dashboard"
              ? "bg-[#7ED321] text-white"
              : "bg-gray-100 text-gray-700"
          } font-semibold py-3 rounded-xl shadow-sm ${btnClass} text-sm`}
        >
          🏠 {t("nav.home", "主頁")}
        </button>

        {isStudent ? (
          <button
            type="button"
            onClick={() => onTabChange("settings")}
            className={`${
              activeTab === "settings"
                ? "bg-[#7ED321] text-white"
                : "bg-gray-100 text-gray-700"
            } font-semibold py-3 rounded-xl shadow-sm ${btnClass} text-sm`}
          >
            ⚙️ {t("nav.settings", "設定")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/coach")}
            className={`bg-[#7ED321] text-white font-semibold py-3 rounded-xl shadow-md ${btnClass} text-sm`}
          >
            👨‍🏫 {t("nav.coach", "教練")}
          </button>
        )}

        {isStudent ? (
          <button
            type="button"
            onClick={() => router.push("/add-meal")}
            className={`${themeBtn} text-white font-semibold py-3 rounded-xl shadow-md ${btnClass} text-sm`}
          >
            ➕ {t("nav.addMeal", "飲食")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/coach/records")}
            className={`bg-[#7ED321] text-white font-semibold py-3 rounded-xl shadow-md ${btnClass} text-sm`}
          >
            📋 學員記錄
          </button>
        )}
      </div>
    </nav>
  );
}
