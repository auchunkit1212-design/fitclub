import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { NIGHTLY_REMINDER_HOUR_HKT } from "@/lib/push-server";
import {
  DEFAULT_MORNING_REMINDER_TIME,
  runScheduledStudentReminders,
} from "@/lib/scheduled-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron：
 * - `0 0 * * *` UTC ≈ 08:00 HKT — 朝早提醒（Hobby 每日一次；Pro 可改回 `0,30 * * * *` 支援自訂時間）
 * - `0 14 * * *` UTC ≈ 22:00 HKT — 每晚打卡總結
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const slotParam = request.nextUrl.searchParams.get("slot");
    const slot =
      slotParam === "morning" || slotParam === "nightly"
        ? slotParam
        : undefined;

    const result = await runScheduledStudentReminders({ force, slot });

    return NextResponse.json({
      ok: true,
      forced: force || undefined,
      slot: slot ?? "auto",
      schedule: {
        morningCronUtc: "0 0 * * *",
        defaultMorningTimeHkt: DEFAULT_MORNING_REMINDER_TIME,
        nightlyCronUtc: "0 14 * * *",
        nightlyHourHkt: NIGHTLY_REMINDER_HOUR_HKT,
      },
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
