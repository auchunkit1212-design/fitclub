"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { CoachSuggestCard } from "@/components/CoachSuggestCard";
import { LoadingView } from "@/components/LoadingView";
import { PageHeader } from "@/components/PageHeader";
import { ProFeatureGate } from "@/components/ProFeatureGate";
import { useI18n } from "@/components/I18nProvider";
import { computeTargetProfile, isBodyProfileComplete } from "@/lib/body-profile";
import { fetchStudentBodyProfile } from "@/lib/db";
import { getOwnMealLogs, isToday } from "@/lib/storage";
import { getSession } from "@/lib/session";
import type { MealLog, UserSession } from "@/lib/types";

export default function SuggestPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<UserSession | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [targets, setTargets] = useState({
    calories: 2000,
    protein: 120,
    carbs: 200,
    fats: 65,
  });
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const current = getSession();
    if (!current) {
      router.replace("/register");
      return;
    }
    setSession(current);

    const [ownLogs, body] = await Promise.all([
      getOwnMealLogs(current),
      fetchStudentBodyProfile(current.email),
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
    setReady(true);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const todayLogs = useMemo(() => logs.filter((l) => isToday(l.date)), [logs]);
  const todayCalories = todayLogs.reduce((s, l) => s + l.calories, 0);
  const todayProtein = todayLogs.reduce((s, l) => s + l.protein, 0);
  const todayCarbs = todayLogs.reduce((s, l) => s + (l.carbs || 0), 0);
  const todayFats = todayLogs.reduce((s, l) => s + (l.fats || 0), 0);

  if (!ready || !session) {
    return <LoadingView message={t("common.loading", "載入中…")} />;
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
