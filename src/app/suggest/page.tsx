"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { CoachSuggestCard } from "@/components/CoachSuggestCard";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { ProFeatureGate } from "@/components/ProFeatureGate";
import { useI18n } from "@/components/I18nProvider";
import { useRequiredSession } from "@/components/SessionProvider";
import { computeTargetProfile, isBodyProfileComplete } from "@/lib/body-profile";
import { defaultMealLogsFromDate, fetchOwnMealLogsForSession, fetchStudentBodyProfile } from "@/lib/db";
import { isToday } from "@/lib/storage";
import type { MealLog } from "@/lib/types";

export default function SuggestPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session } = useRequiredSession();
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [targets, setTargets] = useState({
    calories: 2000,
    protein: 120,
    carbs: 200,
    fats: 65,
  });

  const load = useCallback(async () => {
    if (!session) return;
    const [ownLogs, body] = await Promise.all([
      fetchOwnMealLogsForSession(session, { from: defaultMealLogsFromDate(7) }),
      fetchStudentBodyProfile(session.email),
    ]);
    setLogs(ownLogs);

    if (body && isBodyProfileComplete(body)) {
      const computed = computeTargetProfile(body);
      const cal = computed.targetCalories;
      setTargets({
        calories: cal,
        protein: computed.targetProtein,
        carbs: Math.round((cal * 0.4) / 4),
        fats: Math.round((cal * 0.28) / 9),
      });
    }
  }, [session]);

  useEffect(() => {
    if (session) void load();
  }, [load, session]);

  const todayLogs = useMemo(() => logs.filter((l) => isToday(l.date)), [logs]);
  const todayCalories = todayLogs.reduce((s, l) => s + l.calories, 0);
  const todayProtein = todayLogs.reduce((s, l) => s + l.protein, 0);
  const todayCarbs = todayLogs.reduce((s, l) => s + (l.carbs || 0), 0);
  const todayFats = todayLogs.reduce((s, l) => s + (l.fats || 0), 0);

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-32 max-w-lg mx-auto">
        <PageHeader
          title={t("community.hub.coach-suggest.title", "教練！食咩好？")}
          subtitle={t("community.hub.coach-suggest.subtitle", "按剩餘宏量配餐")}
          onBack={() => router.push("/community")}
        />
        <main className="px-4 py-4">
          <PageSkeleton rows={3} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-32 max-w-lg mx-auto">
      <PageHeader
        title={t("community.hub.coach-suggest.title", "教練！食咩好？")}
        subtitle={t(
          "community.hub.coach-suggest.subtitle",
          "按剩餘宏量配餐"
        )}
        onBack={() => router.push("/community")}
        backLabel={t("leaderboard.back", "← 探索")}
      />
      <main className="px-4 py-4 space-y-4">
        <p className="text-sm text-zinc-600 leading-relaxed">
          {t(
            "suggest.intro",
            "根據你今日已食同剩餘額度，大猩猩建議下一餐。教練同學員都可以用。"
          )}
        </p>
        <ProFeatureGate feature="AI 推薦菜單">
          <CoachSuggestCard
            targetCalories={targets.calories}
            targetProtein={targets.protein}
            targetCarbs={targets.carbs}
            targetFats={targets.fats}
            consumedCalories={todayCalories}
            consumedProtein={todayProtein}
            consumedCarbs={todayCarbs}
            consumedFats={todayFats}
            mealsLoggedToday={todayLogs.length}
          />
        </ProFeatureGate>
      </main>
      <BottomNav
        role={session.role === "admin" ? "admin" : session.role}
      />
    </div>
  );
}
