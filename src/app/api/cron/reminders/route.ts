import { NextRequest, NextResponse } from "next/server";
import {
  resolveRemindersForNow,
  runScheduledPushBroadcast,
} from "@/lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

/** Vercel Cron：每小時檢查香港時間，發送飲水 / 飲食提醒 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";

    if (force) {
      const { sendTestPushToAll } = await import("@/lib/push-server");
      const result = await sendTestPushToAll();
      return NextResponse.json({ ok: true, forced: true, ...result });
    }

    const preview = resolveRemindersForNow();

    if (preview.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: "此香港時間段無預定提醒",
        hourHkt: new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Hong_Kong",
          hour: "numeric",
          hour12: false,
        }).format(new Date()),
        schedule: {
          waterHoursHkt: [8, 10, 12, 14, 16, 18, 20],
          mealHoursHkt: [8, 12, 19],
        },
      });
    }

    const result = await runScheduledPushBroadcast();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
