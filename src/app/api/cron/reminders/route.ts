import { NextRequest, NextResponse } from "next/server";
import {
  getHongKongHour,
  NIGHTLY_REMINDER_HOUR_HKT,
  runScheduledPushBroadcast,
} from "@/lib/push-server";
import { isCronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron（每日 UTC 14:00 ≈ HKT 22:00）：每晚一次打卡總結或明日提示 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const result = await runScheduledPushBroadcast({ force });

    if (!force && result.sent === 0 && result.payloads.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: `僅在香港時間 ${NIGHTLY_REMINDER_HOUR_HKT}:00 發送每晚提醒`,
        hourHkt: getHongKongHour(),
        schedule: {
          nightlyHourHkt: NIGHTLY_REMINDER_HOUR_HKT,
          vercelCronUtc: "0 14 * * *",
        },
      });
    }

    return NextResponse.json({ ok: true, forced: force || undefined, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
