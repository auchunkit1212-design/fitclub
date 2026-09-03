import { NextResponse } from "next/server";
import { notifyCoachStudentsBulk } from "@/lib/coach-notifications";
import { fetchAllUsers, filterStudentsForSession } from "@/lib/db";
import { fetchTodayLogsForEmail } from "@/lib/phase4-db";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 教練一鍵向名下全部學員發送 App 飲食提醒推播 */
export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  if (session.role !== "coach" && session.role !== "admin") {
    return NextResponse.json({ error: "僅教練可操作" }, { status: 403 });
  }

  try {
    const registry = await fetchAllUsers();
    const students = filterStudentsForSession(session, registry);

    if (students.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "未有學員可提醒",
        total: 0,
        sentStudents: 0,
      });
    }

    const todayMealCountByEmail = new Map<string, number>();
    await Promise.all(
      students.map(async (student) => {
        const logs = await fetchTodayLogsForEmail(student.email);
        todayMealCountByEmail.set(student.email, logs.length);
      })
    );

    const result = await notifyCoachStudentsBulk({
      coachName: session.name || "教練",
      students: students.map((s) => ({
        email: s.email,
        name: s.name,
        todayMealCount: todayMealCountByEmail.get(s.email) ?? 0,
      })),
    });

    if (result.sentStudents === 0) {
      return NextResponse.json({
        ok: false,
        error: "全部學員均未訂閱 App 推播",
        hint: "請提醒學員喺 App 設定開啟「飲水與飲食提醒」，並允許系統通知",
        ...result,
      });
    }

    return NextResponse.json({
      ok: true,
      ...result,
      message: `已發送提醒俾 ${result.sentStudents} 位學員`,
    });
  } catch (error) {
    console.error("[coach/nudge-all]", error);
    return NextResponse.json(
      {
        error: "批量推播發送失敗",
        hint: "請確認 VAPID 已設定，並已執行 supabase/push_subscriptions.sql",
      },
      { status: 500 }
    );
  }
}
