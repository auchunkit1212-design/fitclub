import { NextResponse } from "next/server";
import { applyMealLogStreak, fetchStudentStreak } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function studentOnly(session: ReturnType<typeof parseSessionFromRequest>) {
  if (!session?.email || session.role !== "student") {
    return null;
  }
  return session.email;
}

export async function GET(request: Request) {
  const email = studentOnly(parseSessionFromRequest(request));
  if (!email) {
    return NextResponse.json({ error: "僅學員可讀取" }, { status: 403 });
  }

  const streak = await fetchStudentStreak(email);
  return NextResponse.json({ streak });
}

/** 客戶端直寫 meal_logs 後補算 streak（fallback 儲存路徑） */
export async function POST(request: Request) {
  const email = studentOnly(parseSessionFromRequest(request));
  if (!email) {
    return NextResponse.json({ error: "僅學員可操作" }, { status: 403 });
  }

  const result = await applyMealLogStreak(email);
  return NextResponse.json({
    streak: {
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      milestoneTriggered: result.milestoneTriggered,
      milestoneDays: result.milestoneDays,
    },
  });
}
