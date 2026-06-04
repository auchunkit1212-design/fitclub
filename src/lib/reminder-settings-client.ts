import type { PersonalSettings } from "@/lib/personal-settings";
import { getSessionRequestHeaders } from "@/lib/session";

/** 將學員提醒設定同步到 Supabase，供 Cron 在 App 外發 Web Push */
export async function syncReminderSettingsToServer(
  settings: PersonalSettings
): Promise<boolean> {
  try {
    const res = await fetch("/api/student/reminder-settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getSessionRequestHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({
        waterReminder: settings.waterReminder,
        mealSchedule: settings.mealSchedule,
        morningReminderTime: settings.morningReminderTime,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadReminderSettingsFromServer(): Promise<Partial<PersonalSettings> | null> {
  try {
    const res = await fetch("/api/student/reminder-settings", {
      credentials: "include",
      headers: getSessionRequestHeaders(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { settings?: Partial<PersonalSettings> };
    return data.settings ?? null;
  } catch {
    return null;
  }
}
