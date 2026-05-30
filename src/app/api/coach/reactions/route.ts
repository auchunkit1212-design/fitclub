import { NextResponse } from "next/server";
import { insertMealReaction } from "@/lib/phase4-db";
import { notifyStudentOfReaction } from "@/lib/meal-notifications";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

const STICKERS = ["👍", "🔥", "💪", "⭐", "🎯", "❤️", "👏", "🥗"];

function isCoachOrAdmin(session: ReturnType<typeof parseSessionFromRequest>) {
  return (
    Boolean(session?.email) &&
    (session?.role === "coach" || session?.role === "admin")
  );
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!isCoachOrAdmin(session)) {
    console.warn("[coach/reactions] unauthorized", {
      hasSession: Boolean(session?.email),
      role: session?.role,
    });
    return NextResponse.json({ error: "僅教練可操作" }, { status: 403 });
  }

  const body = (await request.json()) as {
    mealLogId?: string;
    sticker?: string;
    studentEmail?: string;
  };

  if (!body.mealLogId || !body.sticker) {
    return NextResponse.json({ error: "參數不完整" }, { status: 400 });
  }

  if (!STICKERS.includes(body.sticker)) {
    return NextResponse.json({ error: "無效貼紙" }, { status: 400 });
  }

  try {
    const reaction = await insertMealReaction(
      body.mealLogId,
      session!.email,
      body.sticker,
      { useServiceRole: true }
    );

    if (body.studentEmail) {
      notifyStudentOfReaction(
        body.studentEmail,
        body.sticker,
        session!.name || "教練"
      ).catch((pushErr) => {
        console.warn("[coach/reactions] push notification failed (ignored):", pushErr);
      });
    }

    return NextResponse.json({ reaction });
  } catch (error) {
    const readable = toReadableError(error, "發送失敗");
    console.error("[coach/reactions] insert failed:", readable.message, error);
    return NextResponse.json(
      {
        error: readable.message,
        hint: "請在 Supabase 執行 fix-meal-log-reactions.sql 及確認 SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const mealLogIds =
    new URL(request.url).searchParams.get("mealLogIds")?.split(",") ?? [];

  const { fetchReactionsForMealIds } = await import("@/lib/phase4-db");
  const reactions = await fetchReactionsForMealIds(mealLogIds.filter(Boolean));
  return NextResponse.json({ reactions });
}
