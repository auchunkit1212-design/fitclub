import { NextResponse } from "next/server";
import {
  fetchStudentNutritionTargets,
  upsertStudentNutritionTargets,
} from "@/lib/phase4-db";
import { sendPushToEmails } from "@/lib/push-server";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const studentEmail =
    new URL(request.url).searchParams.get("studentEmail")?.trim() ||
    session.email;

  const targets = await fetchStudentNutritionTargets(studentEmail);
  return NextResponse.json({ targets });
}

export async function PUT(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email || (session.role !== "coach" && session.role !== "admin")) {
    return NextResponse.json({ error: "僅教練可設定" }, { status: 403 });
  }

  const body = (await request.json()) as {
    studentEmail: string;
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFats: number;
    locked: boolean;
  };

  if (!body.studentEmail) {
    return NextResponse.json({ error: "缺少學員" }, { status: 400 });
  }

  const targets = await upsertStudentNutritionTargets({
    studentEmail: body.studentEmail,
    targetCalories: Number(body.targetCalories) || 2000,
    targetProtein: Number(body.targetProtein) || 120,
    targetCarbs: Number(body.targetCarbs) || 200,
    targetFats: Number(body.targetFats) || 65,
    locked: Boolean(body.locked),
    setByCoachEmail: session.email,
  });

  if (body.locked) {
    sendPushToEmails([body.studentEmail], {
      title: "教練聖旨已更新",
      body: `教練已鎖定你嘅每日目標：${targets.targetCalories} kcal · 蛋白 ${targets.targetProtein}g`,
      url: "/",
      tag: "coach-targets",
    }).catch(console.warn);
  }

  return NextResponse.json({ targets });
}
