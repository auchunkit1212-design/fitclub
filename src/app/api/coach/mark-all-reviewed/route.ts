import { NextResponse } from "next/server";
import { insertMealReaction } from "@/lib/phase4-db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

const BULK_ACK_STICKER = "clap";
const MAX_BATCH = 200;

function isCoachOrAdmin(session: ReturnType<typeof parseSessionFromRequest>) {
  return (
    Boolean(session?.email) &&
    (session?.role === "coach" || session?.role === "admin")
  );
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!isCoachOrAdmin(session)) {
    return NextResponse.json({ error: "僅教練可操作" }, { status: 403 });
  }

  const body = (await request.json()) as { mealLogIds?: string[] };
  const mealLogIds = (body.mealLogIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);

  if (mealLogIds.length === 0) {
    return NextResponse.json({ error: "沒有可批閱的飲食紀錄" }, { status: 400 });
  }

  if (mealLogIds.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `一次最多批閱 ${MAX_BATCH} 筆紀錄` },
      { status: 400 }
    );
  }

  const coachEmail = session!.email;
  let marked = 0;
  const errors: string[] = [];

  for (const mealLogId of mealLogIds) {
    try {
      await insertMealReaction(mealLogId, coachEmail, BULK_ACK_STICKER, {
        useServiceRole: true,
      });
      marked += 1;
    } catch (error) {
      errors.push(
        `${mealLogId}: ${toReadableError(error, "寫入失敗").message}`
      );
    }
  }

  if (marked === 0) {
    return NextResponse.json(
      {
        error: "未能標記任何飲食紀錄",
        details: errors.slice(0, 3),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    marked,
    failed: mealLogIds.length - marked,
  });
}
