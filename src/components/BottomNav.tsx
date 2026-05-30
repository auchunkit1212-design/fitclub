"use client";

import { useRouter } from "next/navigation";

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
  const isStudent = role === "student";

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-zinc-200 px-4 pt-3 pb-safe">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onTabChange("dashboard")}
          className={`${
            activeTab === "dashboard"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700"
          } font-semibold py-3 rounded-xl shadow-sm ${btnClass} text-sm`}
        >
          🏠 主頁
        </button>

        {isStudent ? (
          <button
            type="button"
            onClick={() => onTabChange("settings")}
            className={`${
              activeTab === "settings"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700"
            } font-semibold py-3 rounded-xl shadow-sm ${btnClass} text-sm`}
          >
            ⚙️ 設定
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/coach")}
            className={`bg-zinc-800 text-white font-semibold py-3 rounded-xl shadow-md ${btnClass} text-sm`}
          >
            👨‍🏫 教練
          </button>
        )}

        {isStudent ? (
          <button
            type="button"
            onClick={() => router.push("/add-meal")}
            className={`${themeBtn} text-white font-semibold py-3 rounded-xl shadow-md ${btnClass} text-sm`}
          >
            ➕ 飲食
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/coach/records")}
            className={`bg-indigo-600 text-white font-semibold py-3 rounded-xl shadow-md ${btnClass} text-sm`}
          >
            📋 學員記錄
          </button>
        )}
      </div>
    </nav>
  );
}
