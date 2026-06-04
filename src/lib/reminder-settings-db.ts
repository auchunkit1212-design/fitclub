import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  DEFAULT_PERSONAL_SETTINGS,
  type MealScheduleKey,
  type MorningReminderTime,
  type PersonalSettings,
  type WaterReminderKey,
  isMorningReminderTime,
  normalizePersonalSettings,
} from "@/lib/personal-settings";

export interface StudentReminderSettings {
  email: string;
  waterReminder: WaterReminderKey;
  mealSchedule: MealScheduleKey;
  morningReminderTime: MorningReminderTime;
  lastHydrationPushAt?: string;
  lastMealPushKey?: string;
  lastMorningPushKey?: string;
  updatedAt?: string;
}

type Row = {
  email: string;
  water_reminder: string;
  meal_schedule: string;
  morning_reminder_time: string | null;
  last_hydration_push_at: string | null;
  last_meal_push_key: string | null;
  last_morning_push_key: string | null;
  updated_at: string;
};

function mapRow(row: Row): StudentReminderSettings {
  const partial = {
    waterReminder: row.water_reminder,
    mealSchedule: row.meal_schedule,
  };
  const normalized = normalizePersonalSettings(partial);
  const morningRaw = row.morning_reminder_time ?? "";
  const morningReminderTime = isMorningReminderTime(morningRaw)
    ? morningRaw
    : DEFAULT_PERSONAL_SETTINGS.morningReminderTime;

  return {
    email: row.email.trim().toLowerCase(),
    waterReminder: normalized.waterReminder,
    mealSchedule: normalized.mealSchedule,
    morningReminderTime,
    lastHydrationPushAt: row.last_hydration_push_at ?? undefined,
    lastMealPushKey: row.last_meal_push_key ?? undefined,
    lastMorningPushKey: row.last_morning_push_key ?? undefined,
    updatedAt: row.updated_at,
  };
}

export function personalSettingsToReminderRow(
  email: string,
  settings: PersonalSettings
): StudentReminderSettings {
  return {
    email: email.trim().toLowerCase(),
    waterReminder: settings.waterReminder,
    mealSchedule: settings.mealSchedule,
    morningReminderTime: settings.morningReminderTime,
  };
}

export async function fetchReminderSettings(
  email: string
): Promise<StudentReminderSettings | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("student_reminder_settings")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST205") return null;
    throw error;
  }
  return data ? mapRow(data as Row) : null;
}

export async function fetchReminderSettingsForEmails(
  emails: string[]
): Promise<Map<string, StudentReminderSettings>> {
  const map = new Map<string, StudentReminderSettings>();
  if (emails.length === 0) return map;

  const normalized = emails.map((e) => e.trim().toLowerCase());
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("student_reminder_settings")
    .select("*")
    .in("email", normalized);

  if (error) {
    if (error.code === "PGRST205") return map;
    throw error;
  }

  for (const row of data ?? []) {
    const mapped = mapRow(row as Row);
    map.set(mapped.email, mapped);
  }
  return map;
}

export async function upsertReminderSettings(
  settings: StudentReminderSettings
): Promise<StudentReminderSettings> {
  const supabase = getSupabaseAdmin();
  const email = settings.email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("student_reminder_settings")
    .upsert(
      {
        email,
        water_reminder: settings.waterReminder,
        meal_schedule: settings.mealSchedule,
        morning_reminder_time: settings.morningReminderTime,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as Row);
}

export async function markMorningPushSent(
  email: string,
  dateKey: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalized = email.trim().toLowerCase();
  const existing = await fetchReminderSettings(normalized);
  const base =
    existing ??
    personalSettingsToReminderRow(normalized, DEFAULT_PERSONAL_SETTINGS);

  await supabase.from("student_reminder_settings").upsert(
    {
      email: normalized,
      water_reminder: base.waterReminder,
      meal_schedule: base.mealSchedule,
      morning_reminder_time: base.morningReminderTime,
      last_hydration_push_at: base.lastHydrationPushAt ?? null,
      last_meal_push_key: base.lastMealPushKey ?? null,
      last_morning_push_key: dateKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );
}
