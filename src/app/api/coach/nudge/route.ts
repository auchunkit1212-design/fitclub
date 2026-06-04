import { NextResponse } from "next/server";
import { authorizeCoachForStudent } from "@/lib/coach-student-auth";
import { notifyStudentOfCoachMealNudge } from "@/lib/coach-notifications";
import { fetchTodayLogsForEmail } from "@/lib/phase4-db";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 教練遠端 App 推播：提醒學員記錄飲食 */
export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { studentEmail?: string; message?: string };
  try {
    body = (await request.json()) as { studentEmail?: string; message?: string };
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const auth = await authorizeCoachForStudent(session, body.studentEmail ?? "");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const logs = await fetchTodayLogsForEmail(auth.student.email);
    const result = await notifyStudentOfCoachMealNudge({
      studentEmail: auth.student.email,
      studentName: auth.student.name,
      coachName: session.name || "教練",
      message: body.message,
      todayMealCount: logs.length,
    });

    if (result.sent === 0) {
      return NextResponse.json({
        ok: false,
        error: "學員未訂閱 App 推播",
        hint: "請提醒學員喺 App 設定開啟「飲水與飲食提醒」，並允許系統通知",
        sent: result.sent,
        failed: result.failed,
      });
    }

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      studentName: auth.student.name,
    });
  } catch (error) {
    console.error("[coach/nudge]", error);
    return NextResponse.json(
      {
        error: "推播發送失敗",
        hint: "請確認 VAPID 已設定，並已執行 supabase/push_subscriptions.sql",
      },
      { status: 500 }
    );
  }
}
