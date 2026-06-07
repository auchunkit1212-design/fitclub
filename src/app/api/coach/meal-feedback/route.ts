import { NextResponse } from "next/server";
import {
  getCoachFeedbackPreset,
  isValidCoachFeedbackPreset,
} from "@/lib/coach-feedback-presets";
import { authorizeCoachForStudent } from "@/lib/coach-student-auth";
import { toReadableError } from "@/lib/errors";
import { fetchMealLogById } from "@/lib/meal-log-access";
import { notifyStudentOfMealFeedback } from "@/lib/meal-notifications";
import {
  fetchFeedbackForMealIds,
  insertMealFeedback,
  insertMealReaction,
} from "@/lib/phase4-db";
import { isValidSticker, normalizeStickerId } from "@/lib/meal-stickers";
import { parseSessionFromRequest } from "@/lib/session-server";

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

  const body = (await request.json()) as {
    mealLogId?: string;
    studentEmail?: string;
    presetKey?: string;
    sticker?: string;
  };

  if (!body.mealLogId || !body.studentEmail || !body.presetKey) {
    return NextResponse.json({ error: "參數不完整" }, { status: 400 });
  }

  if (!isValidCoachFeedbackPreset(body.presetKey)) {
    return NextResponse.json({ error: "無效評語" }, { status: 400 });
  }

  const preset = getCoachFeedbackPreset(body.presetKey)!;
  const stickerRaw = body.sticker ? normalizeStickerId(body.sticker) : undefined;
  const stickerId =
    stickerRaw && isValidSticker(stickerRaw) ? stickerRaw : undefined;
  if (body.sticker && !stickerId) {
    return NextResponse.json({ error: "無效貼紙" }, { status: 400 });
  }

  const auth = await authorizeCoachForStudent(session!, body.studentEmail);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const meal = await fetchMealLogById(body.mealLogId, { useServiceRole: true });
  if (!meal) {
    return NextResponse.json({ error: "找不到飲食記錄" }, { status: 404 });
  }

  const studentEmail = auth.student.email.trim().toLowerCase();
  if (meal.email.trim().toLowerCase() !== studentEmail) {
    return NextResponse.json({ error: "餐單不屬於此學員" }, { status: 403 });
  }

  try {
    if (stickerId) {
      await insertMealReaction(body.mealLogId, session!.email, stickerId, {
        useServiceRole: true,
      });
    }

    const feedback = await insertMealFeedback(
      {
        mealLogId: body.mealLogId,
        coachEmail: session!.email,
        presetKey: preset.id,
        messageText: preset.message,
        sticker: stickerId,
      },
      { useServiceRole: true }
    );

    notifyStudentOfMealFeedback(
      studentEmail,
      session!.name || "教練",
      preset.message,
      body.mealLogId,
      stickerId
    ).catch((pushErr) => {
      console.warn("[coach/meal-feedback] push failed (ignored):", pushErr);
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    const readable = toReadableError(error, "發送失敗");
    console.error("[coach/meal-feedback] insert failed:", readable.message, error);
    return NextResponse.json(
      {
        error: readable.message,
        hint: "請在 Supabase 執行 supabase/meal-log-feedback.sql",
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

  const feedback = await fetchFeedbackForMealIds(mealLogIds.filter(Boolean));
  return NextResponse.json({ feedback });
}
