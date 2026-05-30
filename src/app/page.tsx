"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BodyProfileFields,
  bodyProfileToFormValues,
} from "@/components/BodyProfileFields";
import { BottomNav } from "@/components/BottomNav";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import { FranchiseConsole } from "@/components/FranchiseConsole";
import { OnboardingModal } from "@/components/OnboardingModal";
import { NutritionDashboard } from "@/components/NutritionDashboard";
import { PushReminderToggle } from "@/components/PushReminderToggle";
import { generateRoast } from "@/lib/ai-mock";
import {
  computeTargetProfile,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import { fetchStudentBodyProfile } from "@/lib/db";
import { fetchUsersForSession, initUserRegistry } from "@/lib/registry";
import { applyBrandToSession, resolveBrandForUser } from "@/lib/branding";
import { goTo } from "@/lib/navigate";
import { clearSession, getSession, saveSession } from "@/lib/session";
import { withTimeout } from "@/lib/with-timeout";
import {
  fetchWeightLogsLastDays,
  upsertWeightLog,
} from "@/lib/weight-logs";
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
  WeightLog,
} from "@/lib/types";
import { getMealImageSrc } from "@/lib/meal-display";
import { DEFAULT_BRANDING } from "@/lib/types";

type ActiveTab = "dashboard" | "settings";

interface PersonalSettings {
  nickname: string;
  job: string;
  mealSchedule: string;
  trainingType: string;
  weeklyFrequency: string;
  waterReminder: string;
}

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const DEFAULT_SETTINGS: PersonalSettings = {
  nickname: "",
  job: "文職 (長坐)",
  mealSchedule: "一日三餐 (正常)",
  trainingType: "重訓 (Weight Training)",
  weeklyFrequency: "3次",
  waterReminder: "每2小時提示",
};

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
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500">
          {current}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-3 rounded-full bg-zinc-200 overflow-hidden">
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [branding, setBranding] = useState<CoachBranding | null>(null);
  const [broadcast, setBroadcast] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [userRegistry, setUserRegistry] = useState<RegistryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState<PersonalSettings>(DEFAULT_SETTINGS);
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
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightLogsLoading, setWeightLogsLoading] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightSaving, setWeightSaving] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const handleLogout = () => {
    clearSession();
    router.push("/register");
  };

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
      const activeSession: UserSession = {
        ...parsed,
        role,
        name: parsed.name || "體驗學員",
        email: parsed.email || "",
        gym: parsed.gym || "未綁定分店",
        isLoggedIn: true,
      };

      setSession(activeSession);
      setProfile(getUserProfile());

      try {
        await withTimeout(initUserRegistry(), 12_000, "雲端初始化逾時");

        const registry = await withTimeout(
          fetchUsersForSession(activeSession),
          12_000,
          "讀取用戶逾時"
        );
        const mealLogs = await withTimeout(
          getMealLogs(activeSession, registry),
          12_000,
          "讀取餐食逾時"
        );
        const brand = await withTimeout(
          resolveBrandForUser(activeSession, registry),
          12_000,
          "讀取品牌逾時"
        );

        if (cancelled) return;

        setUserRegistry(registry);
        setLogs(mealLogs);
        setBranding(brand.branding);
        setBroadcast(brand.broadcast);
        setSession(applyBrandToSession(activeSession, brand));
        saveSession(applyBrandToSession(activeSession, brand));

        if (role === "student" && activeSession.email) {
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
            setWeightLogsLoading(true);
            try {
              const weights = await fetchWeightLogsLastDays(activeSession.email, 7);
              if (!cancelled) {
                setWeightLogs(weights);
                const today = new Date().toISOString().slice(0, 10);
                const todayLog = weights.find((w) => w.logDate === today);
                setWeightInput(
                  todayLog
                    ? String(todayLog.weightKg)
                    : body?.weightKg
                      ? String(body.weightKg)
                      : ""
                );
              }
            } catch {
              if (!cancelled) setWeightLogs([]);
            } finally {
              if (!cancelled) setWeightLogsLoading(false);
            }
          }
        }
        if (!cancelled) setProfileChecked(true);

        const rawSettings = localStorage.getItem("student_settings");
        if (rawSettings) {
          try {
            const settingsParsed = JSON.parse(rawSettings) as Partial<PersonalSettings>;
            setSettings({ ...DEFAULT_SETTINGS, ...settingsParsed });
          } catch {
            // Keep default settings when parse fails
          }
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "雲端讀取失敗";
        setLoadError(message);
        setBranding(DEFAULT_BRANDING);
        setBroadcast("");
        setLogs([]);
        setUserRegistry([]);
        showToast("❌ 雲端讀取失敗，請檢查網絡或 Supabase。");
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (role !== "student") setProfileChecked(true);
        }
      }
    };

    load();

    const timerA = setTimeout(() => {
      setActiveNotification("⏰ 到時間記錄上一餐啦，唔好漏打卡！");
    }, 4000);
    const timerB = setTimeout(() => {
      setActiveNotification("💧 補水提示：依家飲一大杯水先！");
    }, 12000);

    return () => {
      cancelled = true;
      clearTimeout(timerA);
      clearTimeout(timerB);
    };
  }, [router]);

  const isStudent = session?.role === "student";

  const todayLogs = useMemo(
    () => logs.filter((l) => isToday(l.date)),
    [logs]
  );

  useEffect(() => {
    if (!isStudent || todayLogs.length === 0) return;
    const poll = async () => {
      const ids = todayLogs.map((l) => l.id).join(",");
      const res = await fetch(`/api/coach/reactions?mealLogIds=${ids}`);
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

  const handleSaveWeight = async () => {
    if (!session?.email || weightSaving) return;
    const w = Number(weightInput);
    if (!w || w < 30 || w > 300) {
      alert("請輸入有效體重（30–300 kg）");
      return;
    }
    setWeightSaving(true);
    try {
      await upsertWeightLog(session.email, w);
      const refreshed = await fetchWeightLogsLastDays(session.email, 7);
      setWeightLogs(refreshed);
      showToast("✅ 今日體重已記錄");
    } catch (err) {
      const message = err instanceof Error ? err.message : "儲存失敗";
      alert(`體重儲存失敗：${message}\n\n請確認已在 Supabase 執行 phase5-weight-logs.sql`);
    } finally {
      setWeightSaving(false);
    }
  };

  const roast = generateRoast(
    todayCalories,
    targetCalories,
    todayProtein,
    targetProtein
  );

  const theme = getThemeClasses(branding?.themeColor ?? "emerald");
  const title = branding?.appTitle ?? "健身飲食追蹤";

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-zinc-500 px-6 text-center">
        <p>前往登入頁...</p>
        <button
          type="button"
          onClick={() => goTo(router, "/register")}
          className={`px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium ${btnClass}`}
        >
          去登入
        </button>
      </div>
    );
  }

  if (loading || !branding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-zinc-500 px-6 text-center">
        <p>從雲端載入緊...</p>
        {loadError && (
          <>
            <p className="text-sm text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={() => goTo(router, "/register")}
              className={`px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium ${btnClass}`}
            >
              返回登入
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
        onComplete={(saved) => {
          setBodyProfile(saved);
          setBodyForm(bodyProfileToFormValues(saved));
          setProfile(
            computeTargetProfile(saved, {
              job: settings.job,
              weeklyFrequency: settings.weeklyFrequency,
            })
          );
        }}
      />
    );
  }

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto">
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

      {toast && (
        <div className="fixed top-safe left-4 right-4 bg-zinc-900 text-white px-4 py-3 rounded-xl z-50 text-sm font-semibold text-center shadow-lg max-w-lg mx-auto">
          {toast}
        </div>
      )}

      {activeNotification && (
        <div className="fixed top-safe left-4 right-4 max-w-lg mx-auto bg-zinc-900/95 text-white p-4 rounded-2xl z-50 shadow-2xl border border-zinc-700">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold leading-relaxed">{activeNotification}</p>
            <button
              type="button"
              onClick={() => setActiveNotification(null)}
              className="bg-white/10 text-zinc-300 w-6 h-6 rounded-full active:scale-95 active:opacity-80 transition-all cursor-pointer"
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveNotification(null)}
              className="px-3 py-1.5 text-xs rounded-lg bg-zinc-700 active:scale-95 active:opacity-80 transition-all cursor-pointer"
            >
              稍後
            </button>
            <button
              type="button"
              onClick={() => {
                const note = activeNotification;
                setActiveNotification(null);
                if (note?.includes("記錄")) {
                  router.push("/add-meal");
                }
              }}
              className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 active:scale-95 active:opacity-80 transition-all cursor-pointer"
            >
              即刻做
            </button>
          </div>
        </div>
      )}

      <header
        className={`${theme.header} text-white px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-6 rounded-b-3xl shadow-lg`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {branding.logo && (
              <img
                src={branding.logo}
                alt="Logo"
                className="w-8 h-8 rounded-full object-cover bg-white shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-white/80 text-sm">
                {session.role === "coach"
                  ? "教練主頁"
                  : session.role === "admin"
                    ? "老闆主頁"
                    : "學員主頁"}
              </p>
              <h1 className="text-2xl font-bold mt-1 truncate">{title}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={`shrink-0 text-[11px] bg-white/15 px-2 py-1 rounded-lg ${btnClass}`}
          >
            🚪 登出
          </button>
        </div>
        <p className="text-white/90 text-sm mt-2">
          {settings.nickname || session.name} · {session.gym} · 今日已記錄{" "}
          {todayLogs.length} 餐
        </p>
      </header>

      <main className="px-4 -mt-4 space-y-4">
        {activeTab === "dashboard" && (
          <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4 text-sm">
            <div className="flex justify-between items-center">
              <p className="font-semibold text-zinc-900">
                👋 歡迎，{settings.nickname || session.name}
              </p>
              <span className="text-[10px] font-bold uppercase bg-zinc-900 text-white px-2 py-0.5 rounded">
                {session.role === "admin"
                  ? "總控制台"
                  : session.role === "coach"
                    ? "教練"
                    : "學員"}
              </span>
            </div>
            <p className="text-zinc-500 mt-1 font-mono text-xs">{session.email}</p>
            <p className="text-zinc-500 text-xs">📍 {session.gym}</p>
          </section>
        )}

        {activeTab === "dashboard" &&
          (session.role === "admin" || session.role === "coach") && (
            <FranchiseConsole
              session={session}
              registry={userRegistry}
              onRegistryChange={setUserRegistry}
              onToast={showToast}
              onGoCoach={() => router.push("/coach")}
            />
          )}

        {activeTab === "dashboard" && isStudent && coachTargets?.locked && (
          <div className="bg-zinc-900 text-amber-300 px-4 py-3 rounded-xl text-sm font-medium border border-amber-500/40">
            📜 教練聖旨已鎖定目標：{coachTargets.targetCalories} kcal · 蛋白{" "}
            {coachTargets.targetProtein}g · 碳水 {coachTargets.targetCarbs}g · 脂肪{" "}
            {coachTargets.targetFats}g
          </div>
        )}

        {activeTab === "dashboard" && isStudent && coachReactions.length > 0 && (
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm">
            {coachReactions.slice(0, 3).map((r) => (
              <p key={r.id} className="font-medium">
                教練回覆咗你 {r.sticker}
              </p>
            ))}
          </div>
        )}

        {activeTab === "dashboard" && isStudent && broadcast.trim() && (
          <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-md animate-pulse text-sm font-medium">
            📣 教練突發警告: {broadcast}
          </div>
        )}

        {activeTab === "dashboard" && isStudent && (
          <section className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl p-4 shadow-md">
            <p className="text-sm font-semibold text-amber-100 mb-1">
              🤖 專屬教練 AI 點評
            </p>
            <p className="text-sm leading-relaxed">
              你已綁定【{session.gym}】，負責教練【{session.coach || "專業教練組"}】。
              今日{todayLogs.length === 0 ? "仲未打卡" : "進度唔錯"}，記得跟【
              {settings.mealSchedule}】食！
            </p>
          </section>
        )}

        {activeTab === "dashboard" && isStudent ? (
          <>
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
              <h2 className={`text-sm font-semibold ${theme.accent} mb-2`}>
                🤖 AI 教練吐槽
              </h2>
              <p className="text-zinc-800 leading-relaxed">{roast}</p>
              <p className="text-xs text-zinc-500 mt-3">
                你而家設定：{settings.trainingType} · 每星期 {settings.weeklyFrequency}
              </p>
            </section>

            <button
              type="button"
              onClick={() => setShowNutritionDash(true)}
              className={`w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg ${btnClass}`}
            >
              📊 高級營養分析
            </button>

            <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4 space-y-4">
              <h2 className="font-semibold text-zinc-800">今日進度</h2>
              <ProgressBar
                label="熱量"
                current={todayCalories}
                target={targetCalories}
                unit=""
                barClass={theme.bar}
              />
              <ProgressBar
                label="蛋白質"
                current={todayProtein}
                target={targetProtein}
                unit="g"
                barClass={theme.bar}
              />
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-zinc-800">體重趨勢</h2>
                <span className="text-xs text-zinc-400">過去 7 日</span>
              </div>
              <WeightTrendChart logs={weightLogs} loading={weightLogsLoading} />
              <div className="flex gap-2 pt-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="今日體重 (kg)"
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
                />
                <button
                  type="button"
                  disabled={weightSaving}
                  onClick={handleSaveWeight}
                  className={`shrink-0 px-4 py-2.5 rounded-xl ${theme.btn} text-white text-sm font-semibold disabled:opacity-60 ${btnClass}`}
                >
                  {weightSaving ? "儲存中..." : "更新今日體重"}
                </button>
              </div>
            </section>

            {todayLogs.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
                <h2 className="font-semibold text-zinc-800 mb-3">今日餐單</h2>
                <ul className="space-y-2">
                  {todayLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex gap-3 p-2 rounded-xl bg-zinc-50 border border-zinc-100"
                    >
                      {getMealImageSrc(log) && (
                        <img
                          src={getMealImageSrc(log)}
                          alt=""
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {log.mealType} · {log.description}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {log.calories} kcal · 蛋白 {log.protein}g
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : isStudent ? (
          <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4 space-y-4">
            <h2 className="font-semibold text-zinc-800">⚙️ 個人化設定</h2>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">暱稱</label>
              <input
                value={settings.nickname}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, nickname: e.target.value }))
                }
                placeholder="你想教練點叫你"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">工作型態</label>
                <select
                  value={settings.job}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, job: e.target.value }))
                  }
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
                >
                  <option value="文職 (長坐)">文職 (長坐)</option>
                  <option value="外勤 / 零售">外勤 / 零售</option>
                  <option value="高體力勞動">高體力勞動</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">每星期訓練次數</label>
                <select
                  value={settings.weeklyFrequency}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, weeklyFrequency: e.target.value }))
                  }
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
                >
                  <option value="1-2次">1-2次</option>
                  <option value="3次">3次</option>
                  <option value="4-5次">4-5次</option>
                  <option value="日日操">日日操</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">飲食安排</label>
              <select
                value={settings.mealSchedule}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, mealSchedule: e.target.value }))
                }
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                <option value="一日三餐 (正常)">一日三餐 (正常)</option>
                <option value="一日四餐 / 多餐">一日四餐 / 多餐</option>
                <option value="168斷食 (兩餐)">168斷食 (兩餐)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">飲水提醒</label>
              <select
                value={settings.waterReminder}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, waterReminder: e.target.value }))
                }
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                <option value="每1小時提示">每1小時提示</option>
                <option value="每2小時提示">每2小時提示</option>
                <option value="每4小時提示">每4小時提示</option>
                <option value="關閉提示">關閉提示</option>
              </select>
            </div>

            <BodyProfileFields
              values={bodyForm}
              onChange={(patch) =>
                setBodyForm((prev) => ({ ...prev, ...patch }))
              }
            />

            <PushReminderToggle />

            <button
              type="button"
              onClick={async () => {
                localStorage.setItem("student_settings", JSON.stringify(settings));
                const h = Number(bodyForm.heightCm);
                const w = Number(bodyForm.weightKg);
                const a = Number(bodyForm.age);
                const tw = Number(bodyForm.targetWeightKg);
                if (session.email && h && w && a && tw) {
                  try {
                    const res = await fetch("/api/student/profile", {
                      method: "PUT",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: session.email,
                        heightCm: h,
                        weightKg: w,
                        age: a,
                        gender: bodyForm.gender,
                        targetWeightKg: tw,
                        exerciseCaloriesDaily:
                          Number(bodyForm.exerciseCaloriesDaily) || 0,
                      }),
                    });
                    const data = (await res.json()) as {
                      profile?: StudentBodyProfile;
                    };
                    if (data.profile) {
                      setBodyProfile(data.profile);
                      setProfile(
                        computeTargetProfile(data.profile, {
                          job: settings.job,
                          weeklyFrequency: settings.weeklyFrequency,
                        })
                      );
                    }
                  } catch {
                    showToast("身體數據同步失敗，已儲存本地設定。");
                  }
                }
                showToast("設定已儲存");
                setActiveTab("dashboard");
              }}
              className={`w-full ${theme.btn} text-white font-semibold py-3.5 rounded-xl active:scale-95 active:opacity-80 transition-all cursor-pointer`}
            >
              儲存設定
            </button>
          </section>
        ) : null}
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        role={session?.role ?? "student"}
        themeBtn={theme.btn}
      />
    </div>
  );
}
