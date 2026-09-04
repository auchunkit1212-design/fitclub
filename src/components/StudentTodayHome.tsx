"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CoachFeedbackDisplay } from "@/components/CoachFeedbackDisplay";
import { GorillaMascot } from "@/components/GorillaMascot";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import { useI18n } from "@/components/I18nProvider";
import {
  BarChart2,
  Calendar,
  CheckCircle2,
  Flame,
  IconLabel,
  Megaphone,
  Plus,
  Scale,
  Sparkles,
} from "@/components/icons";
import { APP_LOGO_PATH, resolveTenantLogoUrl } from "@/lib/brand";
import type { PersonalSettings } from "@/lib/personal-settings";
import {
  calorieProgressPct,
  formatCountdown,
  getFastingSnapshot,
  latestMealDate,
  remainingCalories,
  todayStatusFromCaloriePct,
  unboundedPct,
  type TodayStatusKey,
} from "@/lib/today-home";
import type {
  MealLog,
  MealLogFeedback,
  MealLogReaction,
  StudentBodyProfile,
  StudentNutritionTargets,
  WeightLog,
} from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const TILE =
  "relative overflow-hidden rounded-[1.75rem] bg-white p-3.5 shadow-[0_10px_28px_rgba(91,72,160,0.06)]";

function statusAccent(key: TodayStatusKey): string {
  if (key === "over") return "text-orange-500";
  if (key === "warmingUp") return "text-violet-500";
  return "text-emerald-600";
}

function statusDot(key: TodayStatusKey): string {
  if (key === "over") return "bg-orange-400";
  if (key === "warmingUp") return "bg-violet-400";
  return "bg-emerald-400";
}

function formatLogDate(isoDate: string, lang: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  if (lang.startsWith("en")) return `${Number(month)}/${Number(day)}`;
  return `${Number(month)}月${Number(day)}日`;
}

function FastingArc({
  progress,
  logoSrc,
}: {
  progress: number;
  logoSrc: string;
}) {
  const t = Math.min(1, Math.max(0, progress));
  const cx = 60;
  const cy = 58;
  const r = 42;
  const angle = Math.PI * (1 - t);
  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  const arcLen = Math.PI * r;
  const dash = Math.max(0.001, t) * arcLen;

  return (
    <div className="relative mx-auto h-[72px] w-[120px]">
      <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
        <path
          d="M18 58 A 42 42 0 0 1 102 58"
          fill="none"
          stroke="#efeaf8"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M18 58 A 42 42 0 0 1 102 58"
          fill="none"
          stroke="#8b7cf6"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen}`}
        />
      </svg>
      <img
        src={logoSrc}
        alt=""
        className="pointer-events-none absolute h-7 w-7 rounded-full bg-white object-contain shadow-sm ring-2 ring-white"
        style={{ left: x - 14, top: y - 14 }}
        onError={(event) => {
          event.currentTarget.src = "/gorilla.svg";
        }}
      />
    </div>
  );
}

function CalorieRing({
  pct,
  logoSrc,
}: {
  pct: number;
  logoSrc: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const radius = 34;
  const ring = 2 * Math.PI * radius;
  const offset = ring - (clamped / 100) * ring;

  return (
    <div className="relative mx-auto h-[88px] w-[88px]">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#f3eefc"
          strokeWidth="8"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#34d399"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={ring}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={logoSrc}
          alt=""
          className="h-10 w-10 rounded-full bg-white object-contain shadow-sm"
          onError={(event) => {
            event.currentTarget.src = "/gorilla.svg";
          }}
        />
      </div>
    </div>
  );
}

function NutrientBar({
  label,
  pct,
  barClass,
}: {
  label: string;
  pct: number;
  barClass: string;
}) {
  const width = Math.min(100, pct);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="font-bold tabular-nums text-gray-800">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

type StudentTodayHomeProps = {
  displayName: string;
  logoUrl?: string;
  todayCalories: number;
  todayProtein: number;
  todayCarbs: number;
  todayFats: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
  exerciseDaily: number;
  todayLogs: MealLog[];
  settings: PersonalSettings;
  bodyProfile: StudentBodyProfile | null;
  weightLogs: WeightLog[];
  weightLogsLoading: boolean;
  weightSaving: boolean;
  onSaveWeight: (weightKg: number) => Promise<void>;
  currentStreak: number;
  roast: string;
  roastLoading: boolean;
  broadcast: string;
  coachTargets: StudentNutritionTargets | null;
  coachReactions: MealLogReaction[];
  coachFeedback: MealLogFeedback[];
  isSoloStudent: boolean;
  onOpenNutrition: () => void;
  onOpenHistory: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  children?: ReactNode;
};

export function StudentTodayHome({
  displayName,
  logoUrl,
  todayCalories,
  todayProtein,
  todayCarbs,
  todayFats,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFats,
  exerciseDaily,
  todayLogs,
  settings,
  bodyProfile,
  weightLogs,
  weightLogsLoading,
  weightSaving,
  onSaveWeight,
  currentStreak,
  roast,
  roastLoading,
  broadcast,
  coachTargets,
  coachReactions,
  coachFeedback,
  isSoloStudent,
  onOpenNutrition,
  onOpenHistory,
  onLogout,
  onOpenProfile,
  children,
}: StudentTodayHomeProps) {
  const { t, lang } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightError, setWeightError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const logoSrc = resolveTenantLogoUrl(logoUrl) ?? APP_LOGO_PATH;
  const caloriePct = calorieProgressPct(todayCalories, targetCalories);
  const statusKey = todayStatusFromCaloriePct(caloriePct);
  const remaining = remainingCalories(
    targetCalories,
    todayCalories,
    exerciseDaily
  );
  const lastMealAt = useMemo(
    () => latestMealDate(todayLogs.map((log) => log.createdAt)),
    [todayLogs]
  );
  const fasting = getFastingSnapshot(
    now,
    settings.mealSchedule === "fasting168" ? lastMealAt : null
  );

  const latestWeight =
    weightLogs.length > 0
      ? weightLogs[weightLogs.length - 1]
      : bodyProfile?.weightKg
        ? {
            weightKg: bodyProfile.weightKg,
            logDate: "",
          }
        : null;
  const todayIso = now.toISOString().slice(0, 10);
  const loggedToday = weightLogs.some((log) => log.logDate === todayIso);
  const hasPlan = Boolean(bodyProfile?.targetWeightKg);

  const proteinPct = unboundedPct(todayProtein, targetProtein);
  const fatPct = unboundedPct(todayFats, targetFats);
  const carbPct = unboundedPct(todayCarbs, targetCarbs);

  const calorieStatusKey: TodayStatusKey =
    todayCalories <= 0
      ? "warmingUp"
      : remaining < 0
        ? "over"
        : "balanced";

  const openWeightSheet = () => {
    const seed =
      weightLogs.find((log) => log.logDate === todayIso)?.weightKg ??
      latestWeight?.weightKg ??
      bodyProfile?.weightKg ??
      "";
    setWeightInput(seed === "" ? "" : String(seed));
    setWeightError("");
    setWeightOpen(true);
  };

  const handleSaveWeight = async () => {
    const value = Number(weightInput);
    if (!value || value < 30 || value > 300) {
      setWeightError(
        t("home.weight.invalidAlert", "請輸入有效體重（30–300 kg）")
      );
      return;
    }
    setWeightError("");
    await onSaveWeight(value);
    setWeightOpen(false);
  };

  return (
    <div className="bg-[#f6f3fb] pb-4">
      <section className="today-hero relative overflow-hidden px-4 pb-10 pt-safe">
        <div className="today-cloud today-cloud-a" aria-hidden />
        <div className="today-cloud today-cloud-b" aria-hidden />
        <div className="today-sparkle today-sparkle-a" aria-hidden />
        <div className="today-sparkle today-sparkle-b" aria-hidden />
        <div className="today-sparkle today-sparkle-c" aria-hidden />

        <div className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenHistory}
            className={`rounded-2xl bg-white/70 p-2 text-violet-600 shadow-sm ${btnClass}`}
            aria-label={t("history.open", "歷史紀錄日曆")}
          >
            <Calendar size={18} strokeWidth={2.25} />
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={onLogout}
              className={`rounded-2xl bg-white/70 px-2.5 py-1.5 text-[10px] text-gray-500 ${btnClass}`}
            >
              {t("header.logout", "登出")}
            </button>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-3 flex max-w-md flex-col items-center">
          <div className="relative">
            <span
              className="absolute -right-5 bottom-8 text-xl"
              aria-hidden
            >
              🌸
            </span>
            <div className="today-mascot-platform absolute -bottom-2 left-1/2 h-10 w-40 -translate-x-1/2 rounded-full bg-white" />
            <GorillaMascot
              logoUrl={logoUrl}
              size="lg"
              className="relative z-10 today-mascot-float"
            />
          </div>
          <div
            className={`mt-5 flex items-center gap-2 text-sm font-semibold ${statusAccent(statusKey)}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${statusDot(statusKey)}`} />
            <span>
              {t(`home.today.status.${statusKey}`, statusKey)} ({caloriePct}%)
            </span>
            {currentStreak > 0 && (
              <span className="inline-flex items-center gap-0.5 text-orange-500">
                <Flame
                  size={14}
                  strokeWidth={2.5}
                  className="fill-orange-400"
                  aria-hidden
                />
                {currentStreak}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-violet-400">
            {t("home.today.hello", "今日好，{name}", { name: displayName })}
          </p>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-4 flex w-full max-w-md flex-col gap-4 px-4">
        <section className={`${TILE} p-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                <Scale size={20} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {t("home.today.weightPlan", "體重計劃")}
                </p>
                {hasPlan && (
                  <p className="text-[11px] text-gray-400">
                    {t("home.today.targetWeight", "目標 {kg} kg", {
                      kg: bodyProfile?.targetWeightKg ?? 0,
                    })}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenProfile}
              className={`shrink-0 rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-bold text-white ${btnClass}`}
            >
              {hasPlan
                ? t("home.today.viewPlan", "睇計劃")
                : t("home.today.newPlan", "新計劃")}
            </button>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-3xl font-bold tracking-tight text-gray-900">
                {latestWeight
                  ? `${latestWeight.weightKg} kg`
                  : t("home.today.noWeight", "未有體重")}
                {loggedToday && (
                  <CheckCircle2
                    size={20}
                    className="text-emerald-500"
                    aria-label={t("home.today.loggedToday", "今日已記錄")}
                  />
                )}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                {latestWeight?.logDate
                  ? t("home.today.updatedOn", "更新於 {date}", {
                      date: formatLogDate(latestWeight.logDate, lang),
                    })
                  : t("home.today.notLoggedToday", "今日未記錄")}
              </p>
            </div>
          </div>
        </section>

        {broadcast.trim() && (
          <div className="rounded-[1.5rem] bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <IconLabel
              icon={Megaphone}
              size="sm"
              iconClassName="text-amber-700"
              gapClass="gap-1.5"
            >
              {t("home.broadcastPrefix", "教練突發警告:")}
            </IconLabel>{" "}
            {broadcast}
          </div>
        )}

        <section>
          <h2 className="mb-3 px-1 text-lg font-bold text-gray-900">
            {t("home.today.activity", "今日動態")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <article className={`${TILE} min-h-[168px]`}>
              <p className="text-[11px] font-medium text-gray-400">
                {fasting.phase === "fasting"
                  ? t("home.today.fastingLeft", "斷食剩餘")
                  : t("home.today.eatingLeft", "進食剩餘")}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-gray-900">
                {formatCountdown(fasting.remainingMs)}
              </p>
              <div className="mt-2">
                <FastingArc progress={fasting.progress} logoSrc={logoSrc} />
              </div>
            </article>

            <article className={`${TILE} min-h-[168px]`}>
              <p className="text-[11px] font-medium text-gray-400">
                {t("home.today.calorieBudget", "熱量預算")}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-gray-900">
                {remaining} kcal
              </p>
              <div className="mt-1">
                <CalorieRing pct={caloriePct} logoSrc={logoSrc} />
              </div>
              <p
                className={`mt-1 text-center text-[11px] font-bold ${statusAccent(calorieStatusKey)}`}
              >
                {t(`home.today.status.${calorieStatusKey}`, calorieStatusKey)}
              </p>
            </article>

            <article className={`${TILE} min-h-[168px]`}>
              <p className="mb-3 text-[11px] font-medium text-gray-400">
                {t("home.today.nutrients", "營養素")}
              </p>
              <div className="space-y-2.5">
                <NutrientBar
                  label={t("common.protein", "蛋白")}
                  pct={proteinPct}
                  barClass="bg-emerald-400"
                />
                <NutrientBar
                  label={t("common.fat", "脂肪")}
                  pct={fatPct}
                  barClass="bg-orange-400"
                />
                <NutrientBar
                  label={t("common.carbs", "碳水")}
                  pct={carbPct}
                  barClass="bg-sky-400"
                />
              </div>
            </article>

            <article className={`${TILE} min-h-[168px]`}>
              <p className="text-[11px] font-medium text-gray-400">
                {t("home.today.weight", "體重")}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
                {latestWeight ? `${latestWeight.weightKg} kg` : "—"}
              </p>
              <div className="-mx-1 mt-1">
                <WeightTrendChart
                  logs={weightLogs}
                  loading={weightLogsLoading}
                  compact
                />
              </div>
              <button
                type="button"
                onClick={openWeightSheet}
                className={`absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#8b7cf6] text-white shadow-[0_8px_20px_rgba(139,124,246,0.45)] ${btnClass}`}
                aria-label={t("home.today.addWeight", "記錄體重")}
              >
                <Plus size={22} strokeWidth={2.5} />
              </button>
            </article>
          </div>
        </section>

        {(coachReactions.length > 0 || coachFeedback.length > 0) && (
          <div className={`${TILE} space-y-2 p-4`}>
            {todayLogs.slice(0, 3).map((log) => {
              const reaction = coachReactions.find((item) => item.mealLogId === log.id);
              const feedback = coachFeedback.find((item) => item.mealLogId === log.id);
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

        <section className={`${TILE} p-4`}>
          <p className="text-sm font-semibold text-violet-700">
            <IconLabel icon={Sparkles} iconClassName="text-violet-500">
              {isSoloStudent
                ? t("home.aiCoach.soloTitle", "大猩猩 AI 私教")
                : t("home.roastTitle", "AI 教練吐槽")}
            </IconLabel>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">
            {roast || t("home.roastLoading", "AI 教練分析緊你今日食咗咩...")}
          </p>
          {roastLoading && (
            <p className="mt-1 text-xs text-gray-400">
              {t("home.roastRefreshing", "根據實際飲食記錄更新中...")}
            </p>
          )}
          {coachTargets?.locked && (
            <p className="mt-3 text-[11px] text-gray-400">
              {t("home.today.lockedHint", "目標已由教練鎖定")}
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={onOpenNutrition}
          className={`w-full rounded-[1.5rem] bg-white py-3.5 text-sm font-semibold text-violet-600 shadow-[0_8px_24px_rgba(91,72,160,0.06)] ${btnClass}`}
        >
          <IconLabel
            icon={BarChart2}
            size="sm"
            className="justify-center"
            iconClassName="text-violet-500"
          >
            {t("home.advancedNutrition", "高級營養分析")}
          </IconLabel>
        </button>

        {children}
      </div>

      {weightOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-900/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[2rem] bg-white px-5 pb-safe pt-5 shadow-2xl sm:rounded-[2rem]">
            <h3 className="text-lg font-bold text-gray-900">
              {t("home.today.addWeight", "記錄體重")}
            </h3>
            <input
              type="number"
              min={30}
              max={300}
              step={0.1}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder={t("home.weight.placeholder", "今日體重 (kg)")}
              className="mt-4 w-full rounded-2xl border border-violet-100 bg-[#f6f3fb] px-4 py-3 text-lg font-semibold text-gray-900 outline-none focus:border-violet-300"
            />
            {weightError ? (
              <p className="mt-2 text-xs text-rose-500">{weightError}</p>
            ) : null}
            <div className="mt-4 flex gap-2 pb-4">
              <button
                type="button"
                onClick={() => setWeightOpen(false)}
                className={`flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-semibold text-gray-600 ${btnClass}`}
              >
                {t("common.cancel", "取消")}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveWeight()}
                disabled={weightSaving}
                className={`flex-1 rounded-2xl bg-[#8b7cf6] py-3 text-sm font-semibold text-white ${btnClass}`}
              >
                {weightSaving
                  ? t("home.weight.saving", "儲存中...")
                  : t("common.save", "儲存")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
