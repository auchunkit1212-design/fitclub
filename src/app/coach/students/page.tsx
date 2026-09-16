"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  COACH_STUDENTS_SECTION_LABELS,
  CoachStudentsSectionPicker,
  type CoachStudentsSection,
} from "@/components/CoachStudentsSectionPicker";
import { BottomNav } from "@/components/BottomNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { ClipboardList } from "@/components/icons";
import { useBranding } from "@/components/BrandingProvider";
import { COACH_ROLES, useRequiredSession } from "@/components/SessionProvider";
import { useCoachMealReviewIndex } from "@/hooks/useCoachMealReviewIndex";
import {
  defaultMealLogsFromDate,
  fetchMealLogsForSession,
  fetchUsersForSession,
  filterStudentsForSession,
} from "@/lib/db";
import { filterUnreviewedMeals } from "@/lib/meal-review-status";
import { errorMessage } from "@/lib/errors";
import { withTimeout } from "@/lib/with-timeout";
import type { MealLog, RegistryUser } from "@/lib/types";

const CoachActivityWall = dynamic(
  () =>
    import("@/components/CoachActivityWall").then((m) => ({
      default: m.CoachActivityWall,
    })),
  { ssr: false, loading: () => <PageSkeleton rows={3} /> }
);
const CoachMealHistoryPanel = dynamic(
  () =>
    import("@/components/CoachMealHistoryPanel").then((m) => ({
      default: m.CoachMealHistoryPanel,
    })),
  { ssr: false, loading: () => <PageSkeleton rows={3} /> }
);
const CoachStudentDailyPanel = dynamic(
  () =>
    import("@/components/CoachStudentDailyPanel").then((m) => ({
      default: m.CoachStudentDailyPanel,
    })),
  { ssr: false, loading: () => <PageSkeleton rows={3} /> }
);
const CoachStudentManagementPanel = dynamic(
  () =>
    import("@/components/CoachStudentManagementPanel").then((m) => ({
      default: m.CoachStudentManagementPanel,
    })),
  { ssr: false, loading: () => <PageSkeleton rows={3} /> }
);
const CoachUnreviewedMealsPanel = dynamic(
  () =>
    import("@/components/CoachUnreviewedMealsPanel").then((m) => ({
      default: m.CoachUnreviewedMealsPanel,
    })),
  { ssr: false, loading: () => <PageSkeleton rows={3} /> }
);

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const LOAD_TIMEOUT_MS = 12_000;

export default function CoachStudentsPage() {
  const router = useRouter();
  const brand = useBranding();
  const { session } = useRequiredSession(COACH_ROLES);
  const [registry, setRegistry] = useState<RegistryUser[]>([]);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [students, setStudents] = useState<RegistryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [section, setSection] = useState<CoachStudentsSection>("daily");
  const sectionInitialized = useRef(false);

  const canReviewMeals =
    session?.role === "coach" || session?.role === "admin";
  const reviewIndex = useCoachMealReviewIndex(
    logs,
    canReviewMeals ? session?.email : null
  );

  const unreviewedCount = useMemo(() => {
    if (!session?.email || !canReviewMeals) return 0;
    return filterUnreviewedMeals(
      logs,
      session.email,
      reviewIndex.reactions,
      reviewIndex.feedback
    ).length;
  }, [
    logs,
    session?.email,
    canReviewMeals,
    reviewIndex.reactions,
    reviewIndex.feedback,
  ]);

  useEffect(() => {
    if (loading || reviewIndex.loading || sectionInitialized.current) return;
    sectionInitialized.current = true;
    if (canReviewMeals && unreviewedCount > 0) {
      setSection("review");
    } else {
      setSection("daily");
    }
  }, [loading, reviewIndex.loading, canReviewMeals, unreviewedCount]);

  const handleReviewChange = useCallback(
    (mealLogId?: string) => {
      if (mealLogId) {
        reviewIndex.markMealReviewed(mealLogId);
      }
      void reviewIndex.reload();
    },
    [reviewIndex]
  );

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!session) return;
    if (!options?.silent) setLoading(true);
    setLoadError(null);

    try {
      const userRegistry = await withTimeout(
        fetchUsersForSession(session),
        LOAD_TIMEOUT_MS,
        "讀取用戶列表逾時"
      );
      const mealLogs = await withTimeout(
        fetchMealLogsForSession(session, userRegistry, {
          from: defaultMealLogsFromDate(14),
        }),
        LOAD_TIMEOUT_MS,
        "讀取飲食記錄逾時"
      );

      setRegistry(userRegistry);
      setLogs(mealLogs);
      setStudents(filterStudentsForSession(session, userRegistry));
    } catch (error) {
      console.error("載入學員資料失敗:", error);
      setLoadError(errorMessage(error, "暫時載唔到學員資料，請稍後再試"));
      setLogs([]);
      setStudents([]);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) void loadData();
  }, [loadData, session]);

  const handleRegistryChange = async () => {
    if (!session) return;
    const updated = await fetchUsersForSession(session);
    setRegistry(updated);
    setStudents(filterStudentsForSession(session, updated));
  };

  const handleLogUpdated = (updated: MealLog) => {
    setLogs((prev) =>
      prev.map((l) => (l.id === updated.id ? updated : l))
    );
  };

  const handleLogDeleted = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const hasStudents = students.length > 0;
  const showEmptyStudents =
    !loading && !loadError && section !== "roster" && !hasStudents;

  return (
    <PullToRefresh onRefresh={() => loadData({ silent: true })}>
    <div className="min-h-screen bg-zinc-50 pb-32 max-w-lg mx-auto">
      <PageHeader
        title="學員"
        subtitle={`${brand.gymName} · ${COACH_STUDENTS_SECTION_LABELS[section]}`}
        variant="dark"
        leftSlot={
          <CoachStudentsSectionPicker
            activeSection={section}
            onSectionChange={setSection}
            unreviewedCount={unreviewedCount}
            isCoach={canReviewMeals}
            onBack={() => router.push("/")}
          />
        }
      />

      <main className="px-4 py-4">
        {loading && !loadError ? (
          <PageSkeleton rows={4} />
        ) : loadError ? (
          <section className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <p className="font-semibold text-red-800">載入失敗</p>
            <p className="text-sm text-red-700 leading-relaxed">{loadError}</p>
            <button
              type="button"
              onClick={() => loadData()}
              className={`w-full py-3 rounded-xl bg-red-700 text-white text-sm font-semibold ${btnClass}`}
            >
              重試
            </button>
          </section>
        ) : (
          <>
            {section === "roster" && session && (
              <CoachStudentManagementPanel
                session={session}
                registry={registry}
                onRegistryChange={handleRegistryChange}
                onToast={showToast}
              />
            )}

            {showEmptyStudents ? (
              <section className="bg-white rounded-2xl border border-zinc-100 p-8 text-center shadow-sm">
                <ClipboardList
                  size={48}
                  strokeWidth={1.5}
                  className="mx-auto mb-3 text-zinc-300"
                  aria-hidden
                />
                <p className="font-semibold text-zinc-800">暫無學員飲食紀錄</p>
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                  新增學員後，佢哋嘅打卡同營養分析會顯示喺呢度。
                </p>
              </section>
            ) : (
              hasStudents && (
                <>
                  {section === "daily" && (
                    <CoachStudentDailyPanel
                      logs={logs}
                      students={students}
                      onLogUpdated={handleLogUpdated}
                      onLogDeleted={handleLogDeleted}
                      onToast={showToast}
                      onReviewChange={handleReviewChange}
                    />
                  )}

                  {section === "review" && canReviewMeals && session && (
                    <CoachUnreviewedMealsPanel
                      logs={logs}
                      students={students}
                      coachEmail={session.email}
                      reactions={reviewIndex.reactions}
                      feedback={reviewIndex.feedback}
                      loading={reviewIndex.loading}
                      onReviewChange={handleReviewChange}
                      onToast={showToast}
                      onLogUpdated={handleLogUpdated}
                      onLogDeleted={handleLogDeleted}
                    />
                  )}

                  {section === "activity" && canReviewMeals && session && (
                    <CoachActivityWall
                      logs={logs}
                      students={students}
                      coachEmail={session.email}
                      reactions={reviewIndex.reactions}
                      feedback={reviewIndex.feedback}
                      onReviewChange={handleReviewChange}
                      onToast={showToast}
                      onLogUpdated={handleLogUpdated}
                      onLogDeleted={handleLogDeleted}
                    />
                  )}

                  {section === "history" && (
                    <CoachMealHistoryPanel
                      logs={logs}
                      students={students}
                      gymName={brand.gymName}
                    />
                  )}
                </>
              )
            )}
          </>
        )}
      </main>

      <BottomNav
        role={session?.role === "admin" ? "admin" : "coach"}
        studentsBadgeCount={canReviewMeals ? unreviewedCount : undefined}
      />

      {toast && (
        <div className="fixed bottom-28 left-4 right-4 max-w-lg mx-auto bg-zinc-900 text-white text-sm text-center py-3 rounded-xl z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
