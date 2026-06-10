"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bodyProfileToFormValues,
} from "@/components/BodyProfileFields";
import { BottomNav } from "@/components/BottomNav";
import { MealDetailModal } from "@/components/MealDetailModal";
import { StudentProfilePanel } from "@/components/StudentProfilePanel";
import { HistoryCalendar } from "@/components/HistoryCalendar";
import { Calendar, CircleUser, IconLabel } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import {
  computeTargetProfile,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import { fetchStudentBodyProfile } from "@/lib/db";
import { fetchUsersForSession, initUserRegistry } from "@/lib/registry";
import { getMealLogs } from "@/lib/storage";
import {
  DEFAULT_PERSONAL_SETTINGS,
  normalizePersonalSettings,
  type PersonalSettings,
} from "@/lib/personal-settings";
import { loadReminderSettingsFromServer } from "@/lib/reminder-settings-client";
import { syncSessionPlan } from "@/lib/plan-client";
import { getSession, getSessionRequestHeaders } from "@/lib/session";
import {
  fetchWeightLogsLastDays,
  upsertWeightLog,
} from "@/lib/weight-logs";
import type {
  MealLog,
  MealLogFeedback,
  MealLogReaction,
  StudentBodyProfile,
  StudentNutritionTargets,
  UserSession,
  WeightLog,
} from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<UserSession | null>(null);
  const [settings, setSettings] = useState<PersonalSettings>(
    DEFAULT_PERSONAL_SETTINGS
  );
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [bodyProfile, setBodyProfile] = useState<StudentBodyProfile | null>(
    null
  );
  const [bodyForm, setBodyForm] = useState(bodyProfileToFormValues(null));
  const [coachTargets, setCoachTargets] = useState<StudentNutritionTargets | null>(
    null
  );
  const [coachReactions, setCoachReactions] = useState<MealLogReaction[]>([]);
  const [coachFeedback, setCoachFeedback] = useState<MealLogFeedback[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightLogsLoading, setWeightLogsLoading] = useState(true);
  const [weightInput, setWeightInput] = useState("");
  const [weightSaving, setWeightSaving] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [targetProtein, setTargetProtein] = useState(120);
  const [selectedMealLog, setSelectedMealLog] = useState<MealLog | null>(null);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const load = useCallback(async () => {
    const parsed = getSession();
    if (!parsed || parsed.role !== "student") {
      router.replace(parsed ? "/" : "/register");
      return;
    }
    const synced = (await syncSessionPlan()) ?? parsed;
    setSession(synced);

    let personal = DEFAULT_PERSONAL_SETTINGS;
    const raw = localStorage.getItem("student_settings");
    if (raw) {
      try {
        personal = normalizePersonalSettings(JSON.parse(raw));
        setSettings(personal);
      } catch {
        // ignore
      }
    }
    const cloud = await loadReminderSettingsFromServer();
    if (cloud) {
      personal = normalizePersonalSettings({ ...personal, ...cloud });
      setSettings(personal);
    }

    await initUserRegistry();
    const registry = await fetchUsersForSession(synced);
    const mealLogs = await getMealLogs(synced, registry);
    setLogs(mealLogs);

    try {
      const streakRes = await fetch("/api/student/streak", {
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      if (streakRes.ok) {
        const data = (await streakRes.json()) as {
          streak?: { currentStreak?: number; longestStreak?: number };
        };
        setCurrentStreak(data.streak?.currentStreak ?? 0);
        setLongestStreak(data.streak?.longestStreak ?? 0);
      }
    } catch {
      // optional
    }

    const body = await fetchStudentBodyProfile(parsed.email);
    setBodyProfile(body);
    setBodyForm(bodyProfileToFormValues(body));
    if (body && isBodyProfileComplete(body)) {
      const targets = computeTargetProfile(body, {
        job: personal.job,
        weeklyFrequency: personal.weeklyFrequency,
      });
      setTargetCalories(targets.targetCalories);
      setTargetProtein(targets.targetProtein);
    }

    const tRes = await fetch("/api/coach/student-targets", {
      credentials: "include",
    });
    const tData = (await tRes.json()) as {
      targets?: StudentNutritionTargets | null;
    };
    if (tData.targets?.locked) {
      setCoachTargets(tData.targets);
      setTargetCalories(tData.targets.targetCalories);
      setTargetProtein(tData.targets.targetProtein);
    }

    setWeightLogsLoading(true);
    try {
      const weights = await fetchWeightLogsLastDays(parsed.email, 7);
      setWeightLogs(weights);
      const today = new Date().toISOString().slice(0, 10);
      const todayLog = weights.find((w) => w.logDate === today);
      setWeightInput(
        todayLog ? String(todayLog.weightKg) : body?.weightKg ? String(body.weightKg) : ""
      );
    } catch {
      setWeightLogs([]);
    } finally {
      setWeightLogsLoading(false);
    }

    setReady(true);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.email || logs.length === 0) return;
    const myIds = logs
      .filter(
        (l) =>
          l.email.trim().toLowerCase() === session.email.trim().toLowerCase()
      )
      .map((l) => l.id);
    if (myIds.length === 0) return;
    const poll = async () => {
      const headers = getSessionRequestHeaders();
      const ids = myIds.join(",");
      const [reactionRes, feedbackRes] = await Promise.all([
        fetch(`/api/coach/reactions?mealLogIds=${ids}`, {
          credentials: "include",
          headers,
        }),
        fetch(`/api/coach/meal-feedback?mealLogIds=${ids}`, {
          credentials: "include",
          headers,
        }),
      ]);
      const reactionData = (await reactionRes.json()) as {
        reactions?: MealLogReaction[];
      };
      const feedbackData = (await feedbackRes.json()) as {
        feedback?: MealLogFeedback[];
      };
      setCoachReactions(reactionData.reactions ?? []);
      setCoachFeedback(feedbackData.feedback ?? []);
    };
    void poll();
  }, [session?.email, logs]);

  const handleSaveWeight = async () => {
    if (!session?.email || weightSaving) return;
    const w = Number(weightInput);
    if (!w || w < 30 || w > 300) {
      alert(t("home.weight.invalidAlert", "請輸入有效體重（30–300 kg）"));
      return;
    }
    setWeightSaving(true);
    try {
      await upsertWeightLog(session.email, w);
      const weights = await fetchWeightLogsLastDays(session.email, 7);
      setWeightLogs(weights);
      showToast(t("home.weight.saved", "體重已記錄"));
    } catch {
      showToast(t("home.weight.saveFailed", "體重儲存失敗"));
    } finally {
      setWeightSaving(false);
    }
  };

  if (!ready || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
        {t("common.loading", "載入中…")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 overflow-x-hidden max-w-lg mx-auto w-full">
      <header className="pt-safe px-4 pb-4 border-b border-gray-100 bg-gradient-to-b from-[#ecfdf5] to-white">
        <h1 className="text-2xl font-bold text-gray-900">
          <IconLabel icon={CircleUser} iconClassName="text-emerald-600" gapClass="gap-2">
            {t("nav.profile", "我的")}
          </IconLabel>
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {t("profile.subtitle", "個人資料、體重趨勢同飲食記錄")}
        </p>
      </header>

      <main className="px-4 py-5 min-w-0 space-y-6">
        <section>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-gray-900">
              <IconLabel icon={Calendar} size="sm" iconClassName="text-emerald-600">
                {t("history.title", "歷史紀錄日曆")}
              </IconLabel>
            </h2>
            <button
              type="button"
              onClick={() => router.push("/history")}
              className="text-[11px] font-semibold text-emerald-600 active:opacity-70"
            >
              {t("history.fullView", "全螢幕")}
            </button>
          </div>
          <HistoryCalendar embedded />
        </section>

        <StudentProfilePanel
          session={session}
          settings={settings}
          onSettingsChange={setSettings}
          bodyProfile={bodyProfile}
          bodyForm={bodyForm}
          onBodyFormChange={(patch) =>
            setBodyForm((prev) => ({ ...prev, ...patch }))
          }
          onBodyProfileSaved={(saved) => {
            setBodyProfile(saved);
            setBodyForm(bodyProfileToFormValues(saved));
            const targets = computeTargetProfile(saved, {
              job: settings.job,
              weeklyFrequency: settings.weeklyFrequency,
            });
            setTargetCalories(targets.targetCalories);
            setTargetProtein(targets.targetProtein);
          }}
          coachTargets={coachTargets}
          logs={logs}
          coachReactions={coachReactions}
          coachFeedback={coachFeedback}
          weightLogs={weightLogs}
          weightLogsLoading={weightLogsLoading}
          weightInput={weightInput}
          onWeightInputChange={setWeightInput}
          onSaveWeight={() => void handleSaveWeight()}
          weightSaving={weightSaving}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          targetCalories={targetCalories}
          targetProtein={targetProtein}
          onSelectMeal={setSelectedMealLog}
          onSaved={showToast}
        />
      </main>

      {selectedMealLog && (
        <MealDetailModal
          log={selectedMealLog}
          onClose={() => setSelectedMealLog(null)}
          onUpdated={(updated) => {
            setSelectedMealLog(updated);
            setLogs((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l))
            );
          }}
          onDeleted={(id) => {
            setSelectedMealLog(null);
            setLogs((prev) => prev.filter((l) => l.id !== id));
            showToast("已刪除飲食記錄");
          }}
        />
      )}

      <BottomNav role="student" onFabClick={() => router.push("/add-meal")} />

      {toast && (
        <div className="fixed bottom-28 left-4 right-4 max-w-lg mx-auto bg-gray-900 text-white text-sm text-center py-3 rounded-xl z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
