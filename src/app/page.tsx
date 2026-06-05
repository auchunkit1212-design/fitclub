"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bodyProfileToFormValues } from "@/components/BodyProfileFields";
import { CoachLogoAvatar } from "@/components/CoachLogoAvatar";
import { GorillaMascot } from "@/components/GorillaMascot";
import {
  BarChart2,
  Bot,
  Calendar,
  Cpu,
  Flame,
  Hand,
  IconLabel,
  MapPin,
  Megaphone,
  MealStickerIcon,
  ScrollText,
  Sparkles,
} from "@/components/icons";
import { BottomNav } from "@/components/BottomNav";
import { MealSearchSheet } from "@/components/MealSearchSheet";
import { StreakMilestoneModal } from "@/components/StreakMilestoneModal";
import { BRAND_NAME, BRAND_TAGLINE, isCustomBrandLogo } from "@/lib/brand";
import { FranchiseConsole } from "@/components/FranchiseConsole";
import { OnboardingModal } from "@/components/OnboardingModal";
import { NutritionDashboard } from "@/components/NutritionDashboard";
import { StudentMicronutrientPanel } from "@/components/StudentMicronutrientPanel";
import { StudentPushPrompt } from "@/components/StudentPushPrompt";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import { generateRoast } from "@/lib/ai-mock";
import {
  consumePendingStreakMilestone,
  storePendingStreakMilestone,
  type StreakMilestoneDay,
} from "@/lib/streak";
import {
  computeTargetProfile,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import { fetchStudentBodyProfile } from "@/lib/db";
import { fetchUsersForSession, initUserRegistry } from "@/lib/registry";
import { applyBrandToSession, resolveBrandForUser } from "@/lib/branding";
import { goTo } from "@/lib/navigate";
import { syncSessionPlan } from "@/lib/plan-client";
import { clearSession, getSession, saveSession, getSessionRequestHeaders } from "@/lib/session";
import { withTimeout } from "@/lib/with-timeout";
import {
  getMealLogs,
  getThemeClasses,
  getUserProfile,
  isToday,
} from "@/lib/storage";
import type {
  CoachBranding,
  MealLog,
  MealLogReaction,
  RegistryUser,
  StudentBodyProfile,
  StudentNutritionTargets,
  UserProfile,
  UserSession,
} from "@/lib/types";
import { DEFAULT_BRANDING } from "@/lib/types";

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

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const SOFT_CARD = "w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]";
const BRAND_BTN = "bg-emerald-600 hover:bg-emerald-700 text-white";
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

export default function StudentDashboard() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [branding, setBranding] = useState<CoachBranding | null>(null);
  const [broadcast, setBroadcast] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [session, setSession] = useState<UserSession | null>(null);
  const [userRegistry, setUserRegistry] = useState<RegistryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [mealSearchOpen, setMealSearchOpen] = useState(false);
  const [quickMealSaving, setQuickMealSaving] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [milestoneModalDays, setMilestoneModalDays] =
    useState<StreakMilestoneDay | null>(null);

  const applyStreakApiPayload = (payload?: {
    currentStreak?: number;
    longestStreak?: number;
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
    if (
      payload.milestoneTriggered &&
      payload.milestoneDays &&
      [3, 7, 14, 30].includes(payload.milestoneDays)
    ) {
      setMilestoneModalDays(payload.milestoneDays as StreakMilestoneDay);
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
    const pending = consumePendingStreakMilestone();
    if (pending) setMilestoneModalDays(pending);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const parsed = getSession();
      if (!parsed) {
        setLoading(false);
        goTo(router, "/register");
        return;
      }

      const role =
        parsed.role === "coach" || parsed.role === "admin"
          ? parsed.role
          : "student";
      const synced = (await syncSessionPlan()) ?? parsed;
      const activeSession: UserSession = {
        ...synced,
        role,
        name: synced.name || t("home.defaults.trialStudent", "體驗學員"),
        email: synced.email || "",
        gym: synced.gym || t("home.defaults.unboundGym", "未綁定分店"),
        isLoggedIn: true,
      };

      setSession(activeSession);
      setProfile(getUserProfile());

      try {
        await withTimeout(initUserRegistry(), 12_000, t("errors.cloudInitTimeout", "雲端初始化逾時"));

        const registry = await withTimeout(
          fetchUsersForSession(activeSession),
          12_000,
          t("errors.fetchUsersTimeout", "讀取用戶逾時")
        );
        const mealLogs = await withTimeout(
          getMealLogs(activeSession, registry),
          12_000,
          t("errors.fetchMealsTimeout", "讀取餐食逾時")
        );
        const brand = await withTimeout(
          resolveBrandForUser(activeSession, registry),
          12_000,
          t("errors.fetchBrandTimeout", "讀取品牌逾時")
        );

        if (cancelled) return;

        setUserRegistry(registry);
        setLogs(mealLogs);
        setBranding(brand.branding);
        setBroadcast(brand.broadcast);
        setSession(applyBrandToSession(activeSession, brand));
        saveSession(applyBrandToSession(activeSession, brand));

        if (role === "student" && activeSession.email) {
          try {
            const streakRes = await fetch("/api/student/streak", {
              credentials: "include",
              headers: getSessionRequestHeaders(),
            });
            if (streakRes.ok) {
              const streakData = (await streakRes.json()) as {
                streak?: { currentStreak?: number; longestStreak?: number };
              };
              if (!cancelled && streakData.streak) {
                setCurrentStreak(streakData.streak.currentStreak ?? 0);
                setLongestStreak(streakData.streak.longestStreak ?? 0);
              }
            }
          } catch {
            // streak columns may not exist yet
          }

          const body = await fetchStudentBodyProfile(activeSession.email);
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
            const tRes = await fetch("/api/coach/student-targets", {
              credentials: "include",
            });
            const tData = (await tRes.json()) as {
              targets?: StudentNutritionTargets | null;
            };
            if (tData.targets?.locked) {
              setCoachTargets(tData.targets);
              setProfile({
                targetCalories: tData.targets.targetCalories,
                targetProtein: tData.targets.targetProtein,
              });
            }
          }
        }
        if (!cancelled) setProfileChecked(true);

        const rawSettings = localStorage.getItem("student_settings");
        if (rawSettings) {
          try {
            const settingsParsed = JSON.parse(rawSettings) as Partial<PersonalSettings>;
            setSettings(normalizePersonalSettings(settingsParsed));
          } catch {
            // Keep default settings when parse fails
          }
        }
        if (role === "student") {
          const cloudReminder = await loadReminderSettingsFromServer();
          if (cloudReminder && !cancelled) {
            setSettings((prev) =>
              normalizePersonalSettings({ ...prev, ...cloudReminder })
            );
          }
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : t("errors.cloudLoadFailed", "雲端讀取失敗");
        setLoadError(message);
        setBranding(DEFAULT_BRANDING);
        setBroadcast("");
        setLogs([]);
        setUserRegistry([]);
        showToast(t("home.errors.cloudLoadFailed", "雲端讀取失敗，請檢查網絡或 Supabase。"));
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (role !== "student") setProfileChecked(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [router, t, lang]);

  const isStudent = session?.role === "student";

  const todayLogs = useMemo(
    () => logs.filter((l) => isToday(l.date)),
    [logs]
  );

  useEffect(() => {
    if (!isStudent || todayLogs.length === 0) return;
    const poll = async () => {
      const ids = todayLogs.map((l) => l.id).join(",");
      const res = await fetch(`/api/coach/reactions?mealLogIds=${ids}`, {
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      const data = (await res.json()) as { reactions?: MealLogReaction[] };
      setCoachReactions(data.reactions ?? []);
    };
    poll();
    const timer = setInterval(poll, 30_000);
    return () => clearInterval(timer);
  }, [todayLogs, isStudent]);

  const todayCalories = todayLogs.reduce((s, l) => s + l.calories, 0);
  const todayProtein = todayLogs.reduce((s, l) => s + l.protein, 0);

  const targetCalories = profile?.targetCalories ?? 2000;
  const targetProtein = profile?.targetProtein ?? 120;
  const targetCarbs = coachTargets?.targetCarbs ?? 200;
  const targetFats = coachTargets?.targetFats ?? 65;
  const needsOnboarding =
    isStudent && profileChecked && !isBodyProfileComplete(bodyProfile);
  const exerciseDaily = bodyProfile?.exerciseCaloriesDaily ?? 0;

  const handleQuickAddMeal = async (item: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => {
    if (!session?.email || quickMealSaving) return;
    setQuickMealSaving(true);
    try {
      const res = await fetch("/api/meals/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          email: session.email,
          mealType: mealTypeByTimeOfDay(),
          description: item.description.trim(),
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      const data = (await res.json()) as {
        streak?: {
          currentStreak?: number;
          longestStreak?: number;
          milestoneTriggered?: boolean;
          milestoneDays?: number;
        };
      };
      applyStreakApiPayload(data.streak);
      const registry = await fetchUsersForSession(session);
      const mealLogs = await getMealLogs(session, registry);
      setLogs(mealLogs);
      setMealSearchOpen(false);
      showToast(t("home.meals.quickSaved", "已記錄：{name}", { name: item.description }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("errors.cloudLoadFailed", "儲存失敗");
      showToast(t("home.meals.quickSaveFailed", "{message}", { message }));
    } finally {
      setQuickMealSaving(false);
    }
  };

  const roast = generateRoast(
    todayCalories,
    targetCalories,
    todayProtein,
    targetProtein,
    lang
  );

  const theme = getThemeClasses(branding?.themeColor ?? "emerald");
  const title = branding?.appTitle ?? BRAND_NAME;

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-zinc-500 px-6 text-center">
        <p>{t("auth.redirectingLogin", "前往登入頁...")}</p>
        <button
          type="button"
          onClick={() => goTo(router, "/register")}
          className={`px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium ${btnClass}`}
        >
          {t("auth.goLogin", "去登入")}
        </button>
      </div>
    );
  }

  if (loading || !branding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-zinc-500 px-6 text-center">
        <p>{t("common.loadingCloud", "從雲端載入緊...")}</p>
        {loadError && (
          <>
            <p className="text-sm text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={() => goTo(router, "/register")}
              className={`px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium ${btnClass}`}
            >
              {t("auth.backToLogin", "返回登入")}
            </button>
          </>
        )}
      </div>
    );
  }

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

  const displayName = settings.nickname || session.name;
  const todayCarbs = todayLogs.reduce((s, l) => s + l.carbs, 0);
  const todayFats = todayLogs.reduce((s, l) => s + l.fats, 0);

  return (
    <div className="min-h-screen bg-white pb-32">
      {isStudent && (
        <StudentPushPrompt
          reminderSettings={settings}
          onSettingsSync={syncReminderSettingsToServer}
        />
      )}

      {showNutritionDash && isStudent && (
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
                exerciseCaloriesDaily: kcal,
              }),
            });
            const data = (await res.json()) as { profile?: StudentBodyProfile };
            if (data.profile) setBodyProfile(data.profile);
          }}
        />
      )}

      {isStudent && (
        <MealSearchSheet
          open={mealSearchOpen}
          onClose={() => setMealSearchOpen(false)}
          onAddToMeal={(item) => {
            void handleQuickAddMeal(item);
          }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 top-safe z-50 px-4 pointer-events-none">
          <div className="mx-auto w-full max-w-md pointer-events-auto">
            <div className="bg-white text-gray-900 px-4 py-3 rounded-2xl text-sm font-semibold text-center shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              {toast}
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mx-auto px-4 py-6 pt-safe flex flex-col gap-5 bg-white min-h-screen">
        <header className="w-full space-y-4">
          <div className="flex items-start justify-between gap-3 w-full">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <GorillaMascot logoUrl={branding?.logo} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 text-xs leading-tight">
                  {BRAND_TAGLINE}
                </p>
                <h1 className="text-xl font-bold text-gray-900 leading-tight mt-0.5 truncate">
                  {displayName}
                </h1>
                <p className="text-gray-500 text-sm mt-0.5 truncate">
                  {session.gym} · {t("home.healthMgmt", "健康管理")}
                </p>
                <p className="text-emerald-600 text-xs font-semibold mt-1 truncate">
                  {title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isStudent && (
                <button
                  type="button"
                  onClick={() => router.push("/history")}
                  className={`p-2 rounded-xl bg-emerald-50 text-emerald-600 ${btnClass}`}
                  aria-label={t("history.open", "歷史紀錄日曆")}
                  title={t("history.open", "歷史紀錄日曆")}
                >
                  <Calendar size={18} strokeWidth={2.25} />
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className={`text-[10px] bg-gray-100 text-gray-500 px-2.5 py-1.5 rounded-xl whitespace-nowrap ${btnClass}`}
              >
                {t("header.logout", "登出")}
              </button>
            </div>
          </div>

          {isStudent && (
            <div className="w-full flex overflow-x-auto gap-3 scrollbar-hide pb-1 -mx-0">
              <div className="shrink-0 flex flex-col items-center gap-1.5 w-[4.5rem]">
                <div className="w-[4.25rem] h-[4.25rem] rounded-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-0.5 ring-2 ring-emerald-600 ring-offset-2 ring-offset-white flex items-center justify-center overflow-hidden">
                  <CoachLogoAvatar
                    logoUrl={branding?.logo ?? session.brandLogo}
                    label={title}
                    size="story"
                  />
                </div>
                <span className="text-[10px] font-medium text-gray-900 text-center truncate w-full">
                  {displayName.split(" ")[0]}
                </span>
              </div>
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
            </div>
          )}

          <div className="w-full flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              {session.role === "coach"
                ? t("home.coachHome", "教練主頁")
                : session.role === "admin"
                  ? t("home.adminHome", "老闆主頁")
                  : t("home.todayMealCount", "今日 {count} 餐", { count: todayLogs.length })}
            </p>
            <LanguageSwitcher />
          </div>
        </header>

      <main className="flex flex-col gap-5 w-full">
        <section className={`${SOFT_CARD} p-5 text-sm`}>
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 text-base min-w-0">
                <IconLabel icon={Hand} iconClassName="text-gray-600">
                  {t("home.welcome", "歡迎，{name}", {
                    name: displayName,
                  })}
                </IconLabel>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {isStudent && currentStreak > 0 && (
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
                )}
              <span className={`text-[10px] font-bold uppercase ${BRAND_BTN} px-2.5 py-1 rounded-full`}>
                {session.role === "admin"
                  ? t("roles.admin", "總控制台")
                  : session.role === "coach"
                    ? t("roles.coach", "教練")
                    : t("roles.student", "學員")}
              </span>
              </div>
            </div>
            <p className="text-gray-500 mt-2 text-xs">{session.email}</p>
            <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1.5">
              <MapPin size={14} strokeWidth={2} className="shrink-0 text-gray-500" aria-hidden />
              {session.gym}
            </p>
        </section>

        {(session.role === "admin" || session.role === "coach") && (
            <FranchiseConsole
              session={session}
              registry={userRegistry}
              onRegistryChange={setUserRegistry}
              onToast={showToast}
              onGoCoach={() => router.push("/coach")}
            />
          )}

        {isStudent && coachTargets?.locked && (
          <div className={`${SOFT_CARD} px-4 py-3 text-sm font-medium text-gray-800 ring-1 ring-emerald-600/30`}>
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
          <div className={`${SOFT_CARD} px-4 py-3 text-sm font-medium text-gray-800 bg-[#ecfdf5]`}>
            <IconLabel icon={Cpu} iconClassName="text-emerald-600">
              {t("home.soloModeBanner", "你正在使用 AI 專屬私教模式 — 每餐記錄後大猩猩會自動批閱！")}
            </IconLabel>
          </div>
        )}

        {isStudent && coachReactions.length > 0 && (
          <div className={`${SOFT_CARD} px-4 py-3 text-sm text-gray-800`}>
            {coachReactions.slice(0, 3).map((r) => (
              <p key={r.id} className="font-medium flex items-center gap-2">
                {t("home.coachReplied", "教練回覆咗你")}
                <MealStickerIcon sticker={r.sticker} size="sm" className="text-violet-700" />
              </p>
            ))}
          </div>
        )}

        {isStudent && !session.isSoloStudent && broadcast.trim() && (
          <div className={`${SOFT_CARD} px-4 py-3 text-sm font-medium text-gray-800 bg-amber-50`}>
            <IconLabel icon={Megaphone} size="sm" iconClassName="text-amber-700" gapClass="gap-1.5">
              {t("home.broadcastPrefix", "教練突發警告:")}
            </IconLabel>{" "}
            {broadcast}
          </div>
        )}

        {isStudent && (
          <section className={`${SOFT_CARD} p-5 bg-gradient-to-br from-[#ecfdf5] to-white`}>
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
            <section className={`${SOFT_CARD} p-5`}>
              <h2 className="text-sm font-semibold text-emerald-600 mb-2">
                <IconLabel icon={Sparkles} iconClassName="text-emerald-600">
                  {t("home.roastTitle", "AI 教練吐槽")}
                </IconLabel>
              </h2>
              <p className="text-gray-900 leading-relaxed">{roast}</p>
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
              className={`w-full ${BRAND_BTN} font-bold py-4 rounded-3xl shadow-[0_8px_30px_rgb(5,150,105,0.25)] ${btnClass}`}
            >
              <IconLabel icon={BarChart2} size="md" className="justify-center" iconClassName="text-white">
                {t("home.advancedNutrition", "高級營養分析")}
              </IconLabel>
            </button>

            <section className={`${SOFT_CARD} p-5 space-y-4`}>
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

            <p className="text-center text-xs text-gray-400">
              {t("home.profileHint", "體重、飲食記錄同個人資料請到「我的」分頁查看")}
            </p>
          </>
        ) : null}
      </main>
      </div>

      {milestoneModalDays && (
        <StreakMilestoneModal
          days={milestoneModalDays}
          onClose={() => setMilestoneModalDays(null)}
        />
      )}

      <BottomNav
        role={session?.role ?? "student"}
        onFabClick={isStudent ? () => setMealSearchOpen(true) : undefined}
      />
    </div>
  );
}
