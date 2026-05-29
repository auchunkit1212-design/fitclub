import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { fetchAllUsers } from "@/lib/db";
import { findInactiveStudentsForCoach } from "@/lib/phase4-db";
import { sendPushToEmails } from "@/lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 每日檢查：學員連續 2 日無打卡 → 提醒教練跟進 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const coaches = (await fetchAllUsers()).filter((u) => u.role === "coach");
  let alerts = 0;

  for (const coach of coaches) {
    const inactive = await findInactiveStudentsForCoach(coach.email, 2);
    if (inactive.length === 0) continue;

    const names = inactive.map((s) => s.name).join("、");
    const { sent } = await sendPushToEmails([coach.email], {
      title: "CRM 偷懶警報",
      body: `⚠️ ${names} 已連續 2 日無飲食打卡，請盡快跟進！`,
      url: "/coach",
      tag: "coach-crm-inactive",
    });
    alerts += sent;
  }

  return NextResponse.json({ ok: true, coachesChecked: coaches.length, pushSent: alerts });
}
