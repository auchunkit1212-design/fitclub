/** Stable keys for personal settings — labels come from i18n. */

export type JobKey = "sedentary" | "field" | "physical";
export type WeeklyFrequencyKey = "1-2" | "3" | "4-5" | "daily";
export type MealScheduleKey = "threeMeals" | "fourMeals" | "fasting168";
export type WaterReminderKey = "1h" | "2h" | "4h" | "off";
export type TrainingTypeKey = "weight" | "cardio" | "mixed";

/** 朝早提醒時間（HKT，30 分鐘一格） */
export const MORNING_REMINDER_TIME_OPTIONS = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
] as const;

export type MorningReminderTime =
  (typeof MORNING_REMINDER_TIME_OPTIONS)[number];

export interface PersonalSettings {
  nickname: string;
  job: JobKey;
  mealSchedule: MealScheduleKey;
  trainingType: TrainingTypeKey;
  weeklyFrequency: WeeklyFrequencyKey;
  waterReminder: WaterReminderKey;
  /** 朝早飲水 + 記錄飲食推播時間（香港時間） */
  morningReminderTime: MorningReminderTime;
}

export const DEFAULT_PERSONAL_SETTINGS: PersonalSettings = {
  nickname: "",
  job: "sedentary",
  mealSchedule: "threeMeals",
  trainingType: "weight",
  weeklyFrequency: "3",
  waterReminder: "2h",
  morningReminderTime: "08:00",
};

export const JOB_KEYS: JobKey[] = ["sedentary", "field", "physical"];
export const WEEKLY_FREQUENCY_KEYS: WeeklyFrequencyKey[] = ["1-2", "3", "4-5", "daily"];
export const MEAL_SCHEDULE_KEYS: MealScheduleKey[] = ["threeMeals", "fourMeals", "fasting168"];
export const WATER_REMINDER_KEYS: WaterReminderKey[] = ["1h", "2h", "4h", "off"];
export const TRAINING_TYPE_KEYS: TrainingTypeKey[] = ["weight", "cardio", "mixed"];

export function isMorningReminderTime(v: string): v is MorningReminderTime {
  return (MORNING_REMINDER_TIME_OPTIONS as readonly string[]).includes(v);
}

export function formatMorningReminderTimeLabel(time: MorningReminderTime): string {
  const [h, m] = time.split(":");
  return `朝早 ${Number(h)}:${m}`;
}

const LEGACY_JOB: Record<string, JobKey> = {
  "文職 (長坐)": "sedentary",
  "外勤 / 零售": "field",
  "高體力勞動": "physical",
};
const LEGACY_FREQUENCY: Record<string, WeeklyFrequencyKey> = {
  "1-2次": "1-2",
  "3次": "3",
  "4-5次": "4-5",
  日日操: "daily",
};
const LEGACY_MEAL_SCHEDULE: Record<string, MealScheduleKey> = {
  "一日三餐 (正常)": "threeMeals",
  "一日四餐 / 多餐": "fourMeals",
  "168斷食 (兩餐)": "fasting168",
};
const LEGACY_WATER: Record<string, WaterReminderKey> = {
  "每1小時提示": "1h",
  "每2小時提示": "2h",
  "每4小時提示": "4h",
  關閉提示: "off",
};
const LEGACY_TRAINING: Record<string, TrainingTypeKey> = {
  "重訓 (Weight Training)": "weight",
  "有氧 (Cardio)": "cardio",
  "混合訓練": "mixed",
};

function isJobKey(v: string): v is JobKey {
  return JOB_KEYS.includes(v as JobKey);
}
function isFrequencyKey(v: string): v is WeeklyFrequencyKey {
  return WEEKLY_FREQUENCY_KEYS.includes(v as WeeklyFrequencyKey);
}
function isMealScheduleKey(v: string): v is MealScheduleKey {
  return MEAL_SCHEDULE_KEYS.includes(v as MealScheduleKey);
}
function isWaterKey(v: string): v is WaterReminderKey {
  return WATER_REMINDER_KEYS.includes(v as WaterReminderKey);
}
function isTrainingKey(v: string): v is TrainingTypeKey {
  return TRAINING_TYPE_KEYS.includes(v as TrainingTypeKey);
}

/** Merge saved settings and migrate legacy Chinese display values to stable keys. */
export function normalizePersonalSettings(
  raw: Partial<Record<string, string>> | null | undefined
): PersonalSettings {
  const base = { ...DEFAULT_PERSONAL_SETTINGS };
  if (!raw) return base;

  if (typeof raw.nickname === "string") base.nickname = raw.nickname;

  const job = raw.job ?? "";
  base.job = isJobKey(job) ? job : LEGACY_JOB[job] ?? base.job;

  const freq = raw.weeklyFrequency ?? "";
  base.weeklyFrequency = isFrequencyKey(freq)
    ? freq
    : LEGACY_FREQUENCY[freq] ?? base.weeklyFrequency;

  const schedule = raw.mealSchedule ?? "";
  base.mealSchedule = isMealScheduleKey(schedule)
    ? schedule
    : LEGACY_MEAL_SCHEDULE[schedule] ?? base.mealSchedule;

  const water = raw.waterReminder ?? "";
  base.waterReminder = isWaterKey(water)
    ? water
    : LEGACY_WATER[water] ?? base.waterReminder;

  const training = raw.trainingType ?? "";
  base.trainingType = isTrainingKey(training)
    ? training
    : LEGACY_TRAINING[training] ?? base.trainingType;

  const morning = raw.morningReminderTime ?? "";
  base.morningReminderTime = isMorningReminderTime(morning)
    ? morning
    : base.morningReminderTime;

  return base;
}
