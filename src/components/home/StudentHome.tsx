"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bodyProfileToFormValues } from "@/components/BodyProfileFields";
import { CoachLogoAvatar } from "@/components/CoachLogoAvatar";
import {
  BarChart2,
  Bot,
  Calendar,
  Cpu,
  Flame,
  IconLabel,
  Megaphone,
  ScrollText,
  Sparkles,
} from "@/components/icons";
import {
  HOME_BRAND_BTN,
  HOME_BTN_CLASS,
  HOME_SOFT_CARD,
  HomeShell,
} from "@/components/home/HomeShell";
import { StudentFeatureGrid } from "@/components/StudentFeatureGrid";
import { useI18n } from "@/components/I18nProvider";
import { generateRoast } from "@/lib/ai-mock";
import { fetchAiRoast } from "@/lib/ai-feedback-client";
import { saveMealViaApi } from "@/lib/meal-save-client";
import {
  consumePendingStreakCelebration,
  type PendingStreakCelebration,
} from "@/lib/streak";
import {
  hasCompletedAppGuide,
  resetAppGuide,
} from "@/lib/app-guide";
import {
  computeTargetProfile,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import {
  defaultMealLogsFromDate,
  fetchOwnMealLogsForSession,
  fetchStudentBodyProfile,
} from "@/lib/db";
import { fetchUsersForSession } from "@/lib/registry";
import { applyBrandToSession, resolveBrandForUser } from "@/lib/branding";
import { brandingFromSession } from "@/lib/home-session";
import { syncSessionPlan } from "@/lib/plan-client";
import { clearSession, saveSession, getSessionRequestHeaders } from "@/lib/session";
import { fetchWithTimeout, withTimeout } from "@/lib/with-timeout";
import {
  getThemeClasses,
  getUserProfile,
  isToday,
} from "@/lib/storage";
import { BRAND_NAME } from "@/lib/brand";
import {
  loadReminderSettingsFromServer,
  syncReminderSettingsToServer,
} from "@/lib/reminder-settings-client";
import {
  DEFAULT_PERSONAL_SETTINGS,
  WEEKLY_FREQUENCY_KEYS,
  normalizePersonalSettings,
  type PersonalSettings,
} from "@/lib/personal-settings";
import type {
  CoachBranding,
  MealLog,
  MealLogFeedback,
  MealLogReaction,
  StudentBodyProfile,
  StudentNutritionTargets,
  UserProfile,
  UserSession,
} from "@/lib/types";

const NutritionDashboard = dynamic(
  () =>
    import("@/components/NutritionDashboard").then((m) => ({
      default: m.NutritionDashboard,
    })),
  { ssr: false }
);

const MealSearchSheet = dynamic(
  () =>
    import("@/components/MealSearchSheet").then((m) => ({
      default: m.MealSearchSheet,
    })),
  { ssr: false }
);

const CoachSuggestCard = dynamic(
  () =>
    import("@/components/CoachSuggestCard").then((m) => ({
      default: m.CoachSuggestCard,
    })),
  { ssr: false }
);

const StreakMilestoneModal = dynamic(
  () =>
    import("@/components/StreakMilestoneModal").then((m) => ({
      default: m.StreakMilestoneModal,
    })),
  { ssr: false }
);

const OnboardingModal = dynamic(
  () =>
    import("@/components/OnboardingModal").then((m) => ({
      default: m.OnboardingModal,
    })),
  { ssr: false }
);

const StudentAppGuide = dynamic(
  () =>
    import("@/components/StudentAppGuide").then((m) => ({
      default: m.StudentAppGuide,
    })),
  { ssr: false }
);

const ProFeatureGate = dynamic(
  () =>
    import("@/components/ProFeatureGate").then((m) => ({
      default: m.ProFeatureGate,
    })),
  { ssr: false }
);

const StudentMicronutrientPanel = dynamic(
  () =>
    import("@/components/StudentMicronutrientPanel").then((m) => ({
      default: m.StudentMicronutrientPanel,
    })),
  { ssr: false }
);

const CoachFeedbackDisplay = dynamic(
  () =>
    import("@/components/CoachFeedbackDisplay").then((m) => ({
      default: m.CoachFeedbackDisplay,
    })),
  { ssr: false }
);

const StudentPushPrompt = dynamic(
  () =>
    import("@/components/StudentPushPrompt").then((m) => ({
      default: m.StudentPushPrompt,
    })),
  { ssr: false }
);

const BRAND_BAR = "bg-emerald-600";

function mealTypeByTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 10) return "早餐";
  if (h < 14) return "午餐";
  if (h < 17) return "下午茶";
  if (h < 21) return "晚餐";
  return "宵夜";
}

function MacroStoryRing({
  label,
  current,
  target,
  unit,
  accentClass,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  accentClass: string;
}) {
  const pct = Math.min(100, Math.round((current / Math.max(target, 1)) * 100)) || 0;
  const ring = 2 * Math.PI * 26;
  const offset = ring - (pct / 100) * ring;
  return (
    <div className="shrink-0 flex flex-col items-center gap-1.5 w-[4.5rem]">
      <div className="relative w-[4.25rem] h-[4.25rem] rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center">
        <svg
          width="56"
          height="56"
          viewBox="0 0 56 56"
          className={`-rotate-90 ${accentClass}`}
        >
          <circle cx="28" cy="28" r="26" fill="none" stroke="#f3f4f6" strokeWidth="4" />
          <circle
            cx="28"
            cy="28"
            r="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={ring}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-900">
          {pct}%
        </span>
      </div>
      <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">
        {label}
      </span>
      <span className="text-[9px] text-gray-400 text-center -mt-0.5">
        {current}
        {unit}
      </span>
    </div>
  );
}

const FREQUENCY_LABEL_KEY = {
  "1-2": "settings.frequency.low",
  "3": "settings.frequency.medium",
  "4-5": "settings.frequency.high",
  daily: "settings.frequency.daily",
} as const;

const TRAINING_LABEL_KEY = {
  weight: "settings.training.weightTraining",
  cardio: "settings.training.cardio",
  mixed: "settings.training.mixed",
} as const;

function ProgressBar({
  label,
  current,
  target,
  unit,
  barClass,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  barClass: string;
}) {
  const pct = Math.min(100, Math.round((current / target) * 100)) || 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        <span className="text-gray-500">
          {current}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function StudentHome({
  initialSession,
}: {
  initialSession: UserSession;
}) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [branding, setBranding] = useState<CoachBranding>(() =>
    brandingFromSession(initialSession)
  );
  const [broadcast, setBroadcast] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [session, setSession] = useState<UserSession>(initialSession);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const silentRefreshRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState<PersonalSettings>(DEFAULT_PERSONAL_SETTINGS);
  const [bodyProfile, setBodyProfile] = useState<StudentBodyProfile | null>(
    null
  );
  const [bodyForm, setBodyForm] = useState(bodyProfileToFormValues(null));
  const [showNutritionDash, setShowNutritionDash] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [coachTargets, setCoachTargets] = useState<StudentNutritionTargets | null>(
    null
  );
  const [coachReactions, setCoachReactions] = useState<MealLogReaction[]>([]);
  const [coachFeedback, setCoachFeedback] = useState<MealLogFeedback[]>([]);
  const [mealSearchOpen, setMealSearchOpen] = useState(false);
  const [quickMealSaving, setQuickMealSaving] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [streakCelebration, setStreakCelebration] =
    useState<PendingStreakCelebration | null>(null);
  const [roast, setRoast] = useState("");
  const [roastLoading, setRoastLoading] = useState(false);
  const [showAppGuide, setShowAppGuide] = useState(false);

  const applyStreakApiPayload = (payload?: {
    currentStreak?: number;
    longestStreak?: number;
    celebrationTriggered?: boolean;
    celebrationDays?: number;
    isSpecialMilestone?: boolean;
    milestoneTriggered?: boolean;
    milestoneDays?: number;
  }) => {
    if (!payload) return;
    if (typeof payload.currentStreak === "number") {
      setCurrentStreak(payload.currentStreak);
    }
    if (typeof payload.longestStreak === "number") {
      setLongestStreak(payload.longestStreak);
    }
    const triggered =
      payload.celebrationTriggered ?? payload.milestoneTriggered ?? false;
    const days = payload.celebrationDays ?? payload.milestoneDays;
    if (triggered && days && days >= 1) {
      setStreakCelebration({
        days,
        isSpecialMilestone:
          payload.isSpecialMilestone ??
          [3, 7, 14, 30].includes(days),
      });
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const handleLogout = () => {
    clearSession();
    router.push("/register");
  };

  useEffect(() => {
    const pending = consumePendingStreakCelebration();
    if (pending) setStreakCelebration(pending);
  }, []);

  useEffect(() => {
    const rawSettings = localStorage.getItem("student_settings");
    if (!rawSettings) return;
    try {
      const settingsParsed = JSON.parse(rawSettings) as Partial<PersonalSettings>;
      setSettings(normalizePersonalSettings(settingsParsed));
    } catch {
      // Keep default settings when parse fails
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!silentRefreshRef.current) {
        setCloudLoading(true);
      }
      setLoadError(null);
      setProfile(getUserProfile());
      const current = sessionRef.current;

      try {
        const [synced, mealLogs, registry] = await withTimeout(
          Promise.all([
            syncSessionPlan().catch(() => current),
            fetchOwnMealLogsForSession(current, {
              from: defaultMealLogsFromDate(7),
            }),
            fetchUsersForSession(current),
          ]),
          12_000,
          t("errors.cloudLoadFailed", "雲端讀取失敗")
        );

        if (cancelled) return;

        const active = synced ?? current;
        const brand = await resolveBrandForUser(active, registry);
        const branded = applyBrandToSession(active, brand);
        setLogs(mealLogs);
        setBranding(brand.branding);
        setBroadcast(brand.broadcast);
        setSession(branded);
        saveSession(branded);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : t("errors.cloudLoadFailed", "雲端讀取失敗");
        setLoadError(message);
        setBroadcast("");
        setLogs([]);
        showToast(
          t("home.errors.cloudLoadFailed", "暫時讀唔到資料，請檢查網絡後再試。")
        );
      } finally {
        if (!cancelled) {
          silentRefreshRef.current = false;
          setCloudLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [t, lang, refreshKey]);

  useEffect(() => {
    if (!session?.email || session.role !== "student") return;

    let cancelled = false;

    const loadStudentExtras = async () => {
      try {
        const headers = getSessionRequestHeaders();
        const [streakRes, body, tRes, cloudReminder] = await withTimeout(
          Promise.all([
            fetchWithTimeout("/api/student/streak", {
              credentials: "include",
              headers,
            }),
            fetchStudentBodyProfile(session.email),
            fetchWithTimeout("/api/coach/student-targets", {
              credentials: "include",
            }),
            loadReminderSettingsFromServer(),
          ]),
          10_000
        );

        if (streakRes.ok) {
          const streakData = (await streakRes.json()) as {
            streak?: { currentStreak?: number; longestStreak?: number };
          };
          if (!cancelled && streakData.streak) {
            setCurrentStreak(streakData.streak.currentStreak ?? 0);
            setLongestStreak(streakData.streak.longestStreak ?? 0);
          }
        }

        if (!cancelled) {
          setBodyProfile(body);
          setBodyForm(bodyProfileToFormValues(body));
          if (body && isBodyProfileComplete(body)) {
            setProfile(
              computeTargetProfile(body, {
                job: settings.job,
                weeklyFrequency: settings.weeklyFrequency,
              })
            );
          }
        }

        const tData = (await tRes.json()) as {
          targets?: StudentNutritionTargets | null;
        };
        if (!cancelled && tData.targets?.locked) {
          setCoachTargets(tData.targets);
          setProfile({
            targetCalories: tData.targets.targetCalories,
            targetProtein: tData.targets.targetProtein,
          });
        }

        if (cloudReminder && !cancelled) {
          setSettings((prev) =>
            normalizePersonalSettings({ ...prev, ...cloudReminder })
          );
        }
      } catch {
        // streak columns or profile APIs may not exist yet
      } finally {
        if (!cancelled) setProfileChecked(true);
      }
    };

    void loadStudentExtras();

    return () => {
      cancelled = true;
    };
  }, [
    session?.email,
    session?.role,
    refreshKey,
    settings.job,
    settings.weeklyFrequency,
  ]);

  const isStudent = session?.role === "student";

  const todayLogs = useMemo(
    () => logs.filter((l) => isToday(l.date)),
    [logs]
  );

  useEffect(() => {
    if (!isStudent || todayLogs.length === 0) return;
    const poll = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      const ids = todayLogs.map((l) => l.id).join(",");
      const headers = getSessionRequestHeaders();
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
    poll();
    const timer = setInterval(poll, 30_000);
    return () => clearInterval(timer);
  }, [todayLogs, isStudent]);

  const todayCalories = todayLogs.reduce((s, l) => s + l.calories, 0);
  const todayProtein = todayLogs.reduce((s, l) => s + l.protein, 0);

  const targetCalories = profile?.targetCalories ?? 2000;
  const targetProtein = profile?.targetProtein ?? 120;

  const todayLogKey = useMemo(
    () =>
      todayLogs
        .map((l) => `${l.id}:${l.calories}:${l.protein}`)
        .join("|"),
    [todayLogs]
  );

  useEffect(() => {
    if (!isStudent || !session || cloudLoading) return;

    let cancelled = false;
    const fallback = generateRoast(
      todayCalories,
      targetCalories,
      todayProtein,
      targetProtein,
      lang,
      todayLogs
    );
    setRoast(fallback);

    const loadRoast = async () => {
      setRoastLoading(true);
      try {
        const text = await fetchAiRoast({
          meals: todayLogs,
          targetCalories,
          targetProtein,
          lang,
          studentName: session.name,
        });
        if (!cancelled) setRoast(text);
      } finally {
        if (!cancelled) setRoastLoading(false);
      }
    };

    void loadRoast();
    return () => {
      cancelled = true;
    };
  }, [
    isStudent,
    session,
    todayLogKey,
    targetCalories,
    targetProtein,
    lang,
    cloudLoading,
  ]);

  const targetCarbs = coachTargets?.targetCarbs ?? 200;
  const targetFats = coachTargets?.targetFats ?? 65;
  const needsOnboarding =
    isStudent && profileChecked && !isBodyProfileComplete(bodyProfile);
  const exerciseDaily = bodyProfile?.exerciseCaloriesDaily ?? 0;

  useEffect(() => {
    if (!isStudent || !profileChecked || needsOnboarding) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("guide") === "1") {
      resetAppGuide();
      setShowAppGuide(true);
      router.replace("/", { scroll: false });
      return;
    }
    if (!hasCompletedAppGuide()) {
      setShowAppGuide(true);
    }
  }, [isStudent, profileChecked, needsOnboarding, router]);

  const handleQuickAddMeal = async (item: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    nutritionSource?: import("@/lib/meal-ai-verify").MealBaselineSource;
    advanced?: import("@/lib/types").FoodAdvancedNutrients;
  }) => {
    if (!session?.email || quickMealSaving) return;
    setQuickMealSaving(true);
    try {
      const result = await saveMealViaApi({
        email: session.email,
        mealType: mealTypeByTimeOfDay(),
        description: item.description.trim(),
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        nutritionSource: item.nutritionSource,
        advanced: item.advanced,
      });
      applyStreakApiPayload(result.streak);
      const mealLogs = await fetchOwnMealLogsForSession(session, {
        from: defaultMealLogsFromDate(7),
      });
      setLogs(mealLogs);
      setMealSearchOpen(false);
      const savedName = result.log.description.trim() || item.description.trim();
      if (result.nutritionVerified?.adjusted) {
        showToast(
          t(
            "home.meals.quickSavedAi",
            "AI 覆核後已記錄：{name}",
            { name: savedName }
          )
        );
      } else {
        showToast(
          t("home.meals.quickSaved", "已記錄：{name}", { name: savedName })
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("errors.cloudLoadFailed", "儲存失敗");
      showToast(t("home.meals.quickSaveFailed", "{message}", { message }));
    } finally {
      setQuickMealSaving(false);
    }
  };

  const theme = getThemeClasses(branding.themeColor);
  const title = branding.appTitle || BRAND_NAME;
  const displayName = settings.nickname || session.name;
  const todayCarbs = todayLogs.reduce((s, l) => s + l.carbs, 0);
  const todayFats = todayLogs.reduce((s, l) => s + l.fats, 0);

  if (needsOnboarding && session.email) {
    return (
      <OnboardingModal
        email={session.email}
        initial={bodyProfile ?? undefined}
        themeBtn={theme.btn}
        soloMode={Boolean(session.isSoloStudent)}
        onComplete={(saved) => {
          setBodyProfile(saved);
          setBodyForm(bodyProfileToFormValues(saved));
          setProfile(
            computeTargetProfile(saved, {
              job: settings.job,
              weeklyFrequency: settings.weeklyFrequency,
            })
          );
          if (!hasCompletedAppGuide()) {
            setShowAppGuide(true);
          }
          if (session.isSoloStudent) {
            fetch("/api/coach/student-targets", { credentials: "include" })
              .then((r) => r.json())
              .then((d: { targets?: StudentNutritionTargets | null }) => {
                if (d.targets?.locked) setCoachTargets(d.targets);
              })
              .catch(() => undefined);
          }
        }}
      />
    );
  }

  return (
    <>
      <StudentPushPrompt
        reminderSettings={settings}
        onSettingsSync={syncReminderSettingsToServer}
      />

      {showNutritionDash ? (
        <NutritionDashboard
          logs={todayLogs}
          goalCalories={targetCalories}
          goalProtein={targetProtein}
          goalCarbs={targetCarbs}
          goalFats={targetFats}
          exerciseCalories={exerciseDaily}
          onClose={() => setShowNutritionDash(false)}
          onExerciseChange={async (kcal) => {
            if (!session.email || !bodyProfile) return;
            const res = await fetch("/api/student/profile", {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: session.email,
                heightCm: bodyProfile.heightCm,
                weightKg: bodyProfile.weightKg,
                age: bodyProfile.age,
                gender: bodyProfile.gender,
                targetWeightKg: bodyProfile.targetWeightKg,
                weightChangeKgPerWeek: bodyProfile.weightChangeKgPerWeek,
                exerciseCaloriesDaily: kcal,
              }),
            });
            const data = (await res.json()) as { profile?: StudentBodyProfile };
            if (data.profile) setBodyProfile(data.profile);
          }}
        />
      ) : null}

      <MealSearchSheet
        open={mealSearchOpen}
        onClose={() => setMealSearchOpen(false)}
        onAddToMeal={(item) => {
          void handleQuickAddMeal(item);
        }}
      />

      <HomeShell
        session={session}
        brandingLogo={branding.logo}
        title={title}
        displayName={displayName}
        homeLabel={t("home.todayMealCount", "今日 {count} 餐", {
          count: todayLogs.length,
        })}
        toast={toast}
        onRefresh={() => {
          silentRefreshRef.current = true;
          setRefreshKey((key) => key + 1);
        }}
        onLogout={handleLogout}
        onFabClick={() => setMealSearchOpen(true)}
        headerActions={
          <button
            type="button"
            onClick={() => router.push("/history")}
            className={`p-2 rounded-xl bg-emerald-50 text-emerald-600 ${HOME_BTN_CLASS}`}
            aria-label={t("history.open", "歷史紀錄日曆")}
            title={t("history.open", "歷史紀錄日曆")}
          >
            <Calendar size={18} strokeWidth={2.25} />
          </button>
        }
        extraHeader={
          <div className="w-full flex overflow-x-auto gap-3 scrollbar-hide pb-1 -mx-0">
            <div className="shrink-0 flex flex-col items-center gap-1.5 w-[4.5rem]">
              <div className="w-[4.25rem] h-[4.25rem] rounded-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-0.5 ring-2 ring-emerald-600 ring-offset-2 ring-offset-white flex items-center justify-center overflow-hidden">
                <CoachLogoAvatar
                  logoUrl={branding.logo ?? session.brandLogo}
                  label={title}
                  size="story"
                />
              </div>
              <span className="text-[10px] font-medium text-gray-900 text-center truncate w-full">
                {displayName.split(" ")[0]}
              </span>
            </div>
            {cloudLoading && todayLogs.length === 0 ? (
              [0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="shrink-0 w-[4.5rem] h-[6.5rem] rounded-2xl bg-zinc-100 animate-pulse"
                />
              ))
            ) : (
              <>
                <MacroStoryRing
                  label={t("common.calories", "熱量")}
                  current={todayCalories}
                  target={targetCalories}
                  unit=""
                  accentClass="text-emerald-600"
                />
                <MacroStoryRing
                  label={t("common.protein", "蛋白")}
                  current={todayProtein}
                  target={targetProtein}
                  unit="g"
                  accentClass="text-sky-500"
                />
                <MacroStoryRing
                  label={t("common.carbs", "碳水")}
                  current={todayCarbs}
                  target={targetCarbs}
                  unit="g"
                  accentClass="text-amber-500"
                />
                <MacroStoryRing
                  label={t("common.fat", "脂肪")}
                  current={todayFats}
                  target={targetFats}
                  unit="g"
                  accentClass="text-rose-400"
                />
              </>
            )}
          </div>
        }
        welcomeExtra={
          currentStreak > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-sm font-bold text-orange-500"
              title={t("streak.longestHint", "最長紀錄 {days} 天", {
                days: longestStreak,
              })}
            >
              <Flame
                size={18}
                strokeWidth={2.5}
                className="text-orange-500 fill-orange-400 shrink-0"
                aria-hidden
              />
              {t("streak.days", "{count} 天", { count: currentStreak })}
            </span>
          ) : null
        }
      >
        {loadError ? (
          <p className="text-sm text-red-600 px-1">{loadError}</p>
        ) : null}

        <StudentFeatureGrid
          onLogMeal={() => setMealSearchOpen(true)}
          onOpenNutrition={() => setShowNutritionDash(true)}
        />

        {isStudent && coachTargets?.locked && (
          <div className={`${HOME_SOFT_CARD} px-4 py-3 text-sm font-medium text-gray-800 ring-1 ring-emerald-600/30`}>
            <IconLabel icon={ScrollText} size="sm" iconClassName="text-emerald-600" className="text-sm font-medium text-gray-800">
              {t("home.targets.lockedBanner", "{source}已鎖定目標：{calories} kcal · 蛋白 {protein}g · 碳水 {carbs}g · 脂肪 {fats}g", {
              source: session.isSoloStudent
                ? t("home.targets.lockedSolo", "AI 大猩猩聖旨")
                : t("home.targets.lockedCoach", "教練聖旨"),
              calories: coachTargets.targetCalories,
              protein: coachTargets.targetProtein,
              carbs: coachTargets.targetCarbs,
              fats: coachTargets.targetFats,
            })}
            </IconLabel>
          </div>
        )}

        {isStudent && session.isSoloStudent && (
          <div className={`${HOME_SOFT_CARD} px-4 py-3 text-sm font-medium text-gray-800 bg-[#ecfdf5]`}>
            <IconLabel icon={Cpu} iconClassName="text-emerald-600">
              {t("home.soloModeBanner", "你正在使用 AI 專屬私教模式 — 每餐記錄後大猩猩會自動批閱！")}
            </IconLabel>
          </div>
        )}

        {isStudent &&
          (coachReactions.length > 0 || coachFeedback.length > 0) && (
          <div className={`${HOME_SOFT_CARD} px-4 py-3 text-sm text-gray-800 space-y-2`}>
            {todayLogs.slice(0, 3).map((log) => {
              const reaction = coachReactions.find((r) => r.mealLogId === log.id);
              const feedback = coachFeedback.find((f) => f.mealLogId === log.id);
              if (!reaction && !feedback) return null;
              return (
                <CoachFeedbackDisplay
                  key={log.id}
                  reaction={reaction}
                  feedback={feedback}
                />
              );
            })}
          </div>
        )}

        {isStudent && !session.isSoloStudent && broadcast.trim() && (
          <div className={`${HOME_SOFT_CARD} px-4 py-3 text-sm font-medium text-gray-800 bg-amber-50`}>
            <IconLabel icon={Megaphone} size="sm" iconClassName="text-amber-700" gapClass="gap-1.5">
              {t("home.broadcastPrefix", "教練突發警告:")}
            </IconLabel>{" "}
            {broadcast}
          </div>
        )}

        {isStudent && (
          <section className={`${HOME_SOFT_CARD} p-5 bg-gradient-to-br from-[#ecfdf5] to-white`}>
            <p className="text-sm font-semibold text-emerald-700 mb-1">
              <IconLabel icon={Bot} iconClassName="text-emerald-600">
                {session.isSoloStudent
                  ? t("home.aiCoach.soloTitle", "大猩猩 AI 私教")
                  : t("home.aiCoach.coachTitle", "專屬教練 AI 點評")}
              </IconLabel>
            </p>
            <p className="text-sm leading-relaxed text-gray-700">
              {session.isSoloStudent
                ? t(
                    "home.aiCoach.soloJoined",
                    "你已加入【{gym}】散客計劃。今日{status}，跟 AI 聖旨食就啱！",
                    {
                      gym: session.gym,
                      status:
                        todayLogs.length === 0
                          ? t("home.aiCoach.notLoggedYet", "仲未打卡")
                          : t("home.aiCoach.progressGood", "進度唔錯"),
                    }
                  )
                : t(
                    "home.aiCoach.coachJoined",
                    "你已綁定【{gym}】，負責教練【{coach}】。今日{status}，記得跟【{mealSchedule}】食！",
                    {
                      gym: session.gym,
                      coach: session.coach || t("home.aiCoach.defaultCoach", "專業教練組"),
                      status:
                        todayLogs.length === 0
                          ? t("home.aiCoach.notLoggedYet", "仲未打卡")
                          : t("home.aiCoach.progressGood", "進度唔錯"),
                      mealSchedule: t(`settings.mealSchedules.${settings.mealSchedule}`, settings.mealSchedule),
                    }
                  )}
            </p>
          </section>
        )}

        {isStudent ? (
          <>
            <section className={`${HOME_SOFT_CARD} p-5`}>
              <h2 className="text-sm font-semibold text-emerald-600 mb-2">
                <IconLabel icon={Sparkles} iconClassName="text-emerald-600">
                  {t("home.roastTitle", "AI 教練吐槽")}
                </IconLabel>
              </h2>
              <p className="text-gray-900 leading-relaxed">
                {roast ||
                  t("home.roastLoading", "AI 教練分析緊你今日食咗咩...")}
              </p>
              {roastLoading && (
                <p className="text-xs text-gray-400 mt-1">
                  {t("home.roastRefreshing", "根據實際飲食記錄更新中...")}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-3">
                {t("home.settingsSummary", "你而家設定：{trainingType} · 每星期 {weeklyFrequency}", {
                  trainingType: t(TRAINING_LABEL_KEY[settings.trainingType], settings.trainingType),
                  weeklyFrequency: t(FREQUENCY_LABEL_KEY[settings.weeklyFrequency], settings.weeklyFrequency),
                })}
              </p>
            </section>

            <button
              type="button"
              onClick={() => setShowNutritionDash(true)}
              className={`w-full ${HOME_BRAND_BTN} font-bold py-4 rounded-3xl shadow-[0_8px_30px_rgb(5,150,105,0.25)] ${HOME_BTN_CLASS}`}
            >
              <IconLabel icon={BarChart2} size="md" className="justify-center" iconClassName="text-white">
                {t("home.advancedNutrition", "高級營養分析")}
              </IconLabel>
            </button>

            <section className={`${HOME_SOFT_CARD} p-5 space-y-4`}>
              <h2 className="font-semibold text-gray-900">{t("home.progress.title", "今日進度")}</h2>
              <ProgressBar
                label={t("common.calories", "熱量")}
                current={todayCalories}
                target={targetCalories}
                unit=""
                barClass={BRAND_BAR}
              />
              <ProgressBar
                label={t("common.protein", "蛋白質")}
                current={todayProtein}
                target={targetProtein}
                unit="g"
                barClass={BRAND_BAR}
              />
              <ProgressBar
                label={t("common.carbs", "碳水")}
                current={todayCarbs}
                target={targetCarbs}
                unit="g"
                barClass="bg-amber-500"
              />
              <ProgressBar
                label={t("common.fat", "脂肪")}
                current={todayFats}
                target={targetFats}
                unit="g"
                barClass="bg-rose-400"
              />
            </section>

            <ProFeatureGate feature="AI 推薦菜單">
              <CoachSuggestCard
                targetCalories={targetCalories}
                targetProtein={targetProtein}
                targetCarbs={targetCarbs}
                targetFats={targetFats}
                consumedCalories={todayCalories}
                consumedProtein={todayProtein}
                consumedCarbs={todayCarbs}
                consumedFats={todayFats}
                mealsLoggedToday={todayLogs.length}
              />
            </ProFeatureGate>

            <ProFeatureGate feature="微營養數據分析">
              <StudentMicronutrientPanel
                todayCalories={todayCalories}
                todayCarbs={todayCarbs}
                todayFats={todayFats}
                todayProtein={todayProtein}
                targetCalories={targetCalories}
                targetCarbs={targetCarbs}
                targetFats={targetFats}
                weightKg={bodyProfile?.weightKg}
              />
            </ProFeatureGate>

            <p className="text-center text-xs text-gray-400">
              {t("home.profileHint", "體重、飲食記錄同個人資料請到「我的」分頁查看")}
            </p>
          </>
        ) : null}
      </HomeShell>

      {streakCelebration ? (
        <StreakMilestoneModal
          days={streakCelebration.days}
          isSpecialMilestone={streakCelebration.isSpecialMilestone}
          session={session}
          longestStreak={longestStreak}
          onClose={() => setStreakCelebration(null)}
          onNotify={showToast}
        />
      ) : null}

      <StudentAppGuide
        open={showAppGuide}
        onClose={() => setShowAppGuide(false)}
        themeBtn={theme.btn}
      />
    </>
  );
}
