"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { HistoryCalendar } from "@/components/HistoryCalendar";
import { LoadingView } from "@/components/LoadingView";
import { Calendar, IconLabel } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { getSession } from "@/lib/session";

export default function HistoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "student") {
      router.replace(session ? "/" : "/register");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <LoadingView message={t("common.loading", "載入中…")} />;
  }

  return (
    <div className="min-h-screen bg-white pb-32 overflow-x-hidden max-w-lg mx-auto w-full">
      <header className="pt-safe px-4 pb-4 border-b border-gray-100 bg-gradient-to-b from-[#ecfdf5] to-white">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs text-gray-500 mb-3 active:opacity-70"
        >
          {t("header.back", "← 返回")}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          <IconLabel icon={Calendar} iconClassName="text-emerald-600" gapClass="gap-2">
            {t("history.title", "歷史紀錄日曆")}
          </IconLabel>
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {t("history.subtitle", "回顧打卡紀錄與 AI 點評，綠燈達標、紅燈超標")}
        </p>
      </header>

      <main className="px-4 py-5">
        <HistoryCalendar onSelectedDateChange={setSelectedDate} />
      </main>

      <BottomNav
        role="student"
        onFabClick={() =>
          router.push(
            selectedDate
              ? `/add-meal?date=${encodeURIComponent(selectedDate)}`
              : "/add-meal"
          )
        }
      />
    </div>
  );
}
