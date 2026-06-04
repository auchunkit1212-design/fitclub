import { NextResponse } from "next/server";
import {
  fetchReminderSettings,
  personalSettingsToReminderRow,
  upsertReminderSettings,
} from "@/lib/reminder-settings-db";
import {
  DEFAULT_PERSONAL_SETTINGS,
  normalizePersonalSettings,
  type PersonalSettings,
} from "@/lib/personal-settings";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email || session.role !== "student") {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  try {
    const row = await fetchReminderSettings(session.email);
    const settings: PersonalSettings = row
      ? {
          ...DEFAULT_PERSONAL_SETTINGS,
          waterReminder: row.waterReminder,
          mealSchedule: row.mealSchedule,
          morningReminderTime: row.morningReminderTime,
        }
      : DEFAULT_PERSONAL_SETTINGS;

    return NextResponse.json({ settings, synced: Boolean(row) });
  } catch (error) {
    console.error("[student/reminder-settings] GET", error);
    return NextResponse.json(
      {
        error: "讀取提醒設定失敗",
        hint: "請在 Supabase 執行 supabase/student-reminder-settings.sql",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email || session.role !== "student") {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: Partial<PersonalSettings>;
  try {
    body = (await request.json()) as Partial<PersonalSettings>;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const normalized = normalizePersonalSettings({
    ...DEFAULT_PERSONAL_SETTINGS,
    ...body,
  });

  try {
    const saved = await upsertReminderSettings(
      personalSettingsToReminderRow(session.email, normalized)
    );
    return NextResponse.json({
      ok: true,
      settings: {
        ...DEFAULT_PERSONAL_SETTINGS,
        waterReminder: saved.waterReminder,
        mealSchedule: saved.mealSchedule,
        morningReminderTime: saved.morningReminderTime,
      },
    });
  } catch (error) {
    console.error("[student/reminder-settings] PUT", error);
    return NextResponse.json(
      {
        error: "儲存提醒設定失敗",
        hint: "請在 Supabase 執行 supabase/student-reminder-settings.sql",
      },
      { status: 500 }
    );
  }
}
