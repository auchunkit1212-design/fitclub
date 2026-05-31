import { NextResponse } from "next/server";
import {
  fetchStudentNutritionTargets,
  upsertStudentNutritionTargets,
} from "@/lib/phase4-db";
import { sendPushToEmails } from "@/lib/push-server";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

function parseTargetInt(value: unknown, fallback: number): number {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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
    targetCalories: number | string;
    targetProtein: number | string;
    targetCarbs: number | string;
    targetFats: number | string;
    locked: boolean;
    tenantId?: string;
  };

  if (!body.studentEmail) {
    return NextResponse.json({ error: "缺少學員" }, { status: 400 });
  }

  try {
    const targets = await upsertStudentNutritionTargets(
      {
        studentEmail: body.studentEmail,
        targetCalories: parseTargetInt(body.targetCalories, 2000),
        targetProtein: parseTargetInt(body.targetProtein, 120),
        targetCarbs: parseTargetInt(body.targetCarbs, 200),
        targetFats: parseTargetInt(body.targetFats, 65),
        locked: Boolean(body.locked),
        setByCoachEmail: session.email,
        tenantId: body.tenantId ?? session.tenantId,
      },
      { useServiceRole: true }
    );

    if (body.locked) {
      sendPushToEmails([body.studentEmail], {
        title: "教練聖旨已更新",
        body: `教練已鎖定你嘅每日目標：${targets.targetCalories} kcal · 蛋白 ${targets.targetProtein}g`,
        url: "/",
        tag: "coach-targets",
      }).catch((err) =>
        console.warn("[coach/student-targets] push failed (ignored):", err)
      );
    }

    return NextResponse.json({ targets });
  } catch (error) {
    const readable = toReadableError(error, "儲存失敗");
    console.error("[coach/student-targets] upsert failed:", readable.message, error);
    return NextResponse.json(
      {
        error: readable.message,
        hint: "請執行 phase4-social-ai.sql 或 fix-tenants-branding.sql",
      },
      { status: 500 }
    );
  }
}
