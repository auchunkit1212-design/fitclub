"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachActivityWall } from "@/components/CoachActivityWall";
import { CoachMealHistoryPanel } from "@/components/CoachMealHistoryPanel";
import { CoachStudentDailyPanel } from "@/components/CoachStudentDailyPanel";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { ClipboardList } from "@/components/icons";
import { useBranding } from "@/components/BrandingProvider";
import {
  fetchMealLogsForSession,
  fetchUsersForSession,
  filterStudentsForSession,
} from "@/lib/db";
import { errorMessage } from "@/lib/errors";
import { initUserRegistry } from "@/lib/registry";
import { getSession } from "@/lib/session";
import { withTimeout } from "@/lib/with-timeout";
import type { MealLog, RegistryUser, UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const LOAD_TIMEOUT_MS = 12_000;

export default function CoachRecordsPage() {
  const router = useRouter();
  const brand = useBranding();
  const [session, setSession] = useState<UserSession | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [students, setStudents] = useState<RegistryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const current = getSession();
    if (!current || (current.role !== "coach" && current.role !== "admin")) {
      setLoading(false);
      router.push("/register");
      return;
    }

    setSession(current);

    try {
      await withTimeout(initUserRegistry(), LOAD_TIMEOUT_MS, "雲端初始化逾時");

      const registry = await withTimeout(
        fetchUsersForSession(current),
        LOAD_TIMEOUT_MS,
        "讀取用戶列表逾時"
      );

      const mealLogs = await withTimeout(
        fetchMealLogsForSession(current, registry),
        LOAD_TIMEOUT_MS,
        "讀取飲食記錄逾時"
      );

      setLogs(mealLogs);
      setStudents(filterStudentsForSession(current, registry));
    } catch (error) {
      console.error("載入學員紀錄失敗:", error);
      setLoadError(errorMessage(error, "無法從 Supabase 載入學員飲食記錄"));
      setLogs([]);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        載入學員記錄中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-32 max-w-lg mx-auto">
      <PageHeader
        title="學員飲食記錄"
        subtitle={brand.gymName}
        variant="dark"
        backLabel="← 返回主頁"
        onBack={() => router.push("/")}
      />

      <main className="px-4 py-4 space-y-4">
        {loadError ? (
          <section className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <p className="font-semibold text-red-800">載入失敗</p>
            <p className="text-sm text-red-700 leading-relaxed">{loadError}</p>
            <p className="text-xs text-red-600">
              若錯誤含 RLS / permission / policy，請在 Supabase 執行
              fix-coach-read-rls.sql
            </p>
            <button
              type="button"
              onClick={() => loadData()}
              className={`w-full py-3 rounded-xl bg-red-700 text-white text-sm font-semibold ${btnClass}`}
            >
              重試
            </button>
          </section>
        ) : students.length === 0 ? (
          <section className="bg-white rounded-2xl border border-zinc-100 p-8 text-center shadow-sm">
            <ClipboardList size={48} strokeWidth={1.5} className="mx-auto mb-3 text-zinc-300" aria-hidden />
            <p className="font-semibold text-zinc-800">目前尚無學員紀錄</p>
            <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
              請先在教練後台新增學員，或確認學員已完成飲食打卡。
            </p>
          </section>
        ) : (
          <>
            <CoachStudentDailyPanel logs={logs} students={students} />

            {session?.role === "coach" && (
              <CoachActivityWall
                logs={logs}
                students={students}
                onToast={showToast}
                onLogUpdated={(updated) =>
                  setLogs((prev) =>
                    prev.map((l) => (l.id === updated.id ? updated : l))
                  )
                }
              />
            )}

            <CoachMealHistoryPanel
              logs={logs}
              students={students}
              gymName={brand.gymName}
            />
          </>
        )}
      </main>

      <BottomNav role={session?.role === "admin" ? "admin" : "coach"} />

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto bg-zinc-900 text-white text-sm text-center py-3 rounded-xl z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
