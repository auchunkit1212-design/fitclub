import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import {
  fetchIndependentStudents,
  fetchTodayLogsForEmail,
  fetchStudentNutritionTargets,
} from "@/lib/phase4-db";
import { buildNightlyAiCoachReview } from "@/lib/ai-coach";
import { sendPushToEmails } from "@/lib/push-server";
import { computeTargetProfile } from "@/lib/body-profile";
import { fetchStudentBodyProfile } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getHongKongHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
}

/** 每晚 22:00 HKT：無教練學員 → AI 代理教練晚間點評推播 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const hourHkt = getHongKongHour();

  if (!force && hourHkt !== 22) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "僅香港時間 22:00 執行",
      hourHkt,
    });
  }

  const students = await fetchIndependentStudents();
  let sent = 0;

  for (const student of students) {
    const logs = await fetchTodayLogsForEmail(student.email);
    const locked = await fetchStudentNutritionTargets(student.email);
    let targetCal = locked?.targetCalories ?? 2000;
    let targetPro = locked?.targetProtein ?? 120;

    if (!locked) {
      const body = await fetchStudentBodyProfile(student.email);
      if (body) {
        const t = computeTargetProfile(body);
        targetCal = t.targetCalories;
        targetPro = t.targetProtein;
      }
    }

    const body = buildNightlyAiCoachReview(logs, targetCal, targetPro);
    const result = await sendPushToEmails([student.email], {
      title: "AI 代理教練",
      body: body.slice(0, 180),
      url: "/",
      tag: "ai-coach-nightly",
    });
    sent += result.sent;
  }

  return NextResponse.json({
    ok: true,
    hourHkt,
    students: students.length,
    pushSent: sent,
  });
}
