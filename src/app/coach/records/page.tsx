"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachActivityWall } from "@/components/CoachActivityWall";
import { CoachMealHistoryPanel } from "@/components/CoachMealHistoryPanel";
import { PageHeader } from "@/components/PageHeader";
import { useBranding } from "@/components/BrandingProvider";
import {
  fetchMealLogsForSession,
  fetchUsersForSession,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import type { MealLog, RegistryUser, UserSession } from "@/lib/types";

export default function CoachRecordsPage() {
  const router = useRouter();
  const brand = useBranding();
  const [session, setSession] = useState<UserSession | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [students, setStudents] = useState<RegistryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    const load = async () => {
      const current = getSession();
      if (!current || (current.role !== "coach" && current.role !== "admin")) {
        router.push("/register");
        return;
      }

      setSession(current);

      try {
        const registry = await fetchUsersForSession(current);
        const mealLogs = await fetchMealLogsForSession(current, registry);
        setLogs(mealLogs);
        setStudents(
          registry.filter((u) => {
            if (u.role !== "student") return false;
            if (current.role === "admin") return true;
            return u.addedBy === current.email;
          })
        );
      } catch {
        alert("無法從 Supabase 載入學員飲食記錄。");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        載入學員記錄中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-safe max-w-lg mx-auto">
      <PageHeader
        title="學員飲食記錄"
        subtitle={brand.gymName}
        variant="dark"
        backLabel="← 返回主頁"
        onBack={() => router.push("/")}
      />

      <main className="px-4 py-4 space-y-4">
        {session?.role === "coach" && students.length > 0 && (
          <CoachActivityWall
            logs={logs}
            students={students}
            onToast={showToast}
          />
        )}

        <CoachMealHistoryPanel
          logs={logs}
          students={students}
          gymName={brand.gymName}
        />
      </main>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto bg-zinc-900 text-white text-sm text-center py-3 rounded-xl z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
