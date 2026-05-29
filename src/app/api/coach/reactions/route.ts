import { NextResponse } from "next/server";
import { insertMealReaction } from "@/lib/phase4-db";
import { notifyStudentOfReaction } from "@/lib/meal-notifications";
import { parseSessionFromRequest } from "@/lib/session-server";

const STICKERS = ["👍", "🔥", "💪", "⭐", "🎯", "❤️", "👏", "🥗"];

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email || (session.role !== "coach" && session.role !== "admin")) {
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
      session.email,
      body.sticker
    );

    if (body.studentEmail) {
      notifyStudentOfReaction(
        body.studentEmail,
        body.sticker,
        session.name
      ).catch(console.warn);
    }

    return NextResponse.json({ reaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "發送失敗";
    return NextResponse.json({ error: message }, { status: 500 });
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
