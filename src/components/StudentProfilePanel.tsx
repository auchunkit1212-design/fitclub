"use client";

import {
  BodyProfileFields,
  bodyProfileToFormValues,
} from "@/components/BodyProfileFields";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import {
  Flame,
  IconLabel,
  MealStickerIcon,
  CircleUser,
  ScrollText,
} from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { getMealImageSrc } from "@/lib/meal-display";
import {
  DEFAULT_PERSONAL_SETTINGS,
  JOB_KEYS,
  TRAINING_TYPE_KEYS,
  WEEKLY_FREQUENCY_KEYS,
  normalizePersonalSettings,
  type PersonalSettings,
} from "@/lib/personal-settings";

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
import { getSessionRequestHeaders } from "@/lib/session";
import type {
  MealLog,
  MealLogReaction,
  StudentBodyProfile,
  StudentNutritionTargets,
  UserSession,
  WeightLog,
} from "@/lib/types";

const SOFT_CARD =
  "w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100";

const BRAND_BTN = "bg-emerald-600 hover:bg-emerald-700 text-white";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  session: UserSession;
  settings: PersonalSettings;
  onSettingsChange: (next: PersonalSettings) => void;
  bodyProfile: StudentBodyProfile | null;
  bodyForm: ReturnType<typeof bodyProfileToFormValues>;
  onBodyFormChange: (
    patch: Partial<ReturnType<typeof bodyProfileToFormValues>>
  ) => void;
  onBodyProfileSaved: (profile: StudentBodyProfile) => void;
  coachTargets: StudentNutritionTargets | null;
  logs: MealLog[];
  coachReactions: MealLogReaction[];
  weightLogs: WeightLog[];
  weightLogsLoading: boolean;
  weightInput: string;
  onWeightInputChange: (value: string) => void;
  onSaveWeight: () => void;
  weightSaving: boolean;
  currentStreak: number;
  longestStreak: number;
  targetCalories: number;
  targetProtein: number;
  onSelectMeal: (log: MealLog) => void;
  onSaved: (message: string) => void;
};

export function StudentProfilePanel({
  session,
  settings,
  onSettingsChange,
  bodyProfile,
  bodyForm,
  onBodyFormChange,
  onBodyProfileSaved,
  coachTargets,
  logs,
  coachReactions,
  weightLogs,
  weightLogsLoading,
  weightInput,
  onWeightInputChange,
  onSaveWeight,
  weightSaving,
  currentStreak,
  longestStreak,
  targetCalories,
  targetProtein,
  onSelectMeal,
  onSaved,
}: Props) {
  const { t } = useI18n();
  const displayName = settings.nickname || session.name;

  const myLogs = logs
    .filter(
      (l) =>
        l.email.trim().toLowerCase() === session.email.trim().toLowerCase()
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);

  const saveProfile = async () => {
    const merged = normalizePersonalSettings({
      ...DEFAULT_PERSONAL_SETTINGS,
      ...settings,
    });
    localStorage.setItem("student_settings", JSON.stringify(merged));
    onSettingsChange(merged);

    const h = Number(bodyForm.heightCm);
    const w = Number(bodyForm.weightKg);
    const a = Number(bodyForm.age);
    const tw = Number(bodyForm.targetWeightKg);
    if (session.email && h && w && a && tw) {
      try {
        const res = await fetch("/api/student/profile", {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getSessionRequestHeaders(),
          },
          body: JSON.stringify({
            email: session.email,
            heightCm: h,
            weightKg: w,
            age: a,
            gender: bodyForm.gender,
            targetWeightKg: tw,
            exerciseCaloriesDaily: Number(bodyForm.exerciseCaloriesDaily) || 0,
          }),
        });
        const data = (await res.json()) as { profile?: StudentBodyProfile };
        if (data.profile) {
          onBodyProfileSaved(data.profile);
        }
      } catch {
        onSaved(t("settings.bodySyncFailed", "身體數據同步失敗，已儲存本地設定。"));
        return;
      }
    }
    onSaved(t("profile.saved", "個人資料已儲存"));
  };

  return (
    <div className="space-y-5 min-w-0">
      <section className={`${SOFT_CARD} p-5`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-full bg-emerald-600 text-white text-lg font-bold flex items-center justify-center shrink-0">
            {displayName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-lg text-gray-900 truncate">
              {displayName}
            </h2>
            <p className="text-xs text-gray-500 truncate">{session.email}</p>
            <p className="text-xs text-gray-500 mt-0.5">{session.gym}</p>
          </div>
          {currentStreak > 0 && (
            <span
              className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-orange-500"
              title={t("streak.longestHint", "最長紀錄 {days} 天", {
                days: longestStreak,
              })}
            >
              <Flame
                size={18}
                className="fill-orange-400 text-orange-500"
                aria-hidden
              />
              {t("streak.days", "{count} 天", { count: currentStreak })}
            </span>
          )}
        </div>
      </section>

      <section className={`${SOFT_CARD} p-5 grid grid-cols-2 gap-3`}>
        <div className="rounded-2xl bg-emerald-50 p-3">
          <p className="text-[10px] text-emerald-700 font-semibold uppercase">
            {t("profile.targetCalories", "每日熱量目標")}
          </p>
          <p className="text-xl font-bold text-emerald-800 mt-1">
            {targetCalories}
            <span className="text-sm font-medium"> kcal</span>
          </p>
        </div>
        <div className="rounded-2xl bg-sky-50 p-3">
          <p className="text-[10px] text-sky-700 font-semibold uppercase">
            {t("profile.targetProtein", "蛋白目標")}
          </p>
          <p className="text-xl font-bold text-sky-800 mt-1">
            {targetProtein}
            <span className="text-sm font-medium"> g</span>
          </p>
        </div>
      </section>

      {coachTargets?.locked && (
        <div className={`${SOFT_CARD} px-4 py-3 text-sm font-medium text-gray-800 ring-1 ring-emerald-600/30`}>
          <IconLabel icon={ScrollText} size="sm" iconClassName="text-emerald-600">
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

      <section className={`${SOFT_CARD} p-5 space-y-4`}>
        <h2 className="font-semibold text-gray-900">
          <IconLabel icon={CircleUser} iconClassName="text-emerald-600">
            {t("profile.personalTitle", "個人資料")}
          </IconLabel>
        </h2>
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">
            {t("settings.nickname", "暱稱")}
          </label>
          <input
            value={settings.nickname}
            onChange={(e) =>
              onSettingsChange({ ...settings, nickname: e.target.value })
            }
            placeholder={t("settings.nicknamePlaceholder", "你想教練點叫你")}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">
              {t("settings.job", "工作型態")}
            </label>
            <select
              value={settings.job}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  job: e.target.value as PersonalSettings["job"],
                })
              }
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            >
              {JOB_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`settings.jobs.${key}`, key)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">
              {t("settings.weeklyFrequency", "每星期訓練次數")}
            </label>
            <select
              value={settings.weeklyFrequency}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  weeklyFrequency: e.target
                    .value as PersonalSettings["weeklyFrequency"],
                })
              }
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            >
              {WEEKLY_FREQUENCY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(FREQUENCY_LABEL_KEY[key], key)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">
            {t("settings.trainingType", "訓練類型")}
          </label>
          <select
            value={settings.trainingType}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                trainingType: e.target.value as PersonalSettings["trainingType"],
              })
            }
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          >
            {TRAINING_TYPE_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(TRAINING_LABEL_KEY[key], key)}
              </option>
            ))}
          </select>
        </div>

        <BodyProfileFields
          values={bodyForm}
          onChange={(patch) => onBodyFormChange(patch)}
        />

        <button
          type="button"
          onClick={() => void saveProfile()}
          className={`w-full ${BRAND_BTN} font-semibold py-3.5 rounded-2xl ${btnClass}`}
        >
          {t("profile.saveButton", "儲存個人資料")}
        </button>
      </section>

      <section className={`${SOFT_CARD} p-5 space-y-3 overflow-hidden min-w-0`}>
        <div className="flex justify-between items-center gap-2 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">
            {t("profile.weightTitle", "體重趨勢")}
          </h2>
          <span className="text-xs text-gray-500 shrink-0">
            {t("home.weight.last7Days", "過去 7 日")}
          </span>
        </div>
        <WeightTrendChart logs={weightLogs} loading={weightLogsLoading} />
        <div className="flex flex-row flex-wrap w-full gap-3 pt-1 min-w-0">
          <input
            type="number"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => onWeightInputChange(e.target.value)}
            placeholder={t("home.weight.placeholder", "今日體重 (kg)")}
            className="min-w-0 w-full flex-1 basis-24 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            disabled={weightSaving}
            onClick={onSaveWeight}
            className={`w-full sm:w-auto whitespace-nowrap px-6 py-2.5 rounded-2xl ${BRAND_BTN} text-sm font-semibold disabled:opacity-60 ${btnClass}`}
          >
            {weightSaving
              ? t("home.weight.saving", "儲存中...")
              : t("home.weight.updateButton", "儲存")}
          </button>
        </div>
      </section>

      <section className={`${SOFT_CARD} p-5`}>
        <h2 className="font-semibold text-gray-900 mb-3">
          {t("profile.mealHistory", "飲食記錄")}
        </h2>
        {myLogs.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("profile.noMeals", "暫時未有記錄，撳中間 + 開始打卡")}
          </p>
        ) : (
          <ul className="space-y-2 max-h-[28rem] overflow-y-auto scrollbar-hide">
            {myLogs.map((log) => {
              const reaction = coachReactions.find((r) => r.mealLogId === log.id);
              return (
                <li
                  key={log.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectMeal(log)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectMeal(log);
                    }
                  }}
                  className="p-3 rounded-2xl bg-gray-50 cursor-pointer active:opacity-80"
                >
                  <div className="flex gap-3 min-w-0">
                    {getMealImageSrc(log) && (
                      <img
                        src={getMealImageSrc(log)}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-gray-400">
                        {log.date.slice(0, 10)}
                      </p>
                      <p className="font-medium text-sm truncate">
                        {log.mealType} · {log.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {log.calories} kcal · P{log.protein} C{log.carbs} F
                        {log.fats}
                      </p>
                    </div>
                  </div>
                  {reaction && (
                    <p className="text-xs text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2 mt-2 flex items-center gap-1.5">
                      <MealStickerIcon
                        sticker={reaction.sticker}
                        size="sm"
                        className="text-violet-700"
                      />
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
