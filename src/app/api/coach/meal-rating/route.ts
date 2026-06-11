import { NextResponse } from "next/server";
import { authorizeCoachForStudent } from "@/lib/coach-student-auth";
import { toReadableError } from "@/lib/errors";
import { fetchMealLogById } from "@/lib/meal-log-access";
import { isValidCoachMealRating } from "@/lib/meal-rating";
import {
  fetchRatingsForMealIds,
  insertMealRating,
} from "@/lib/phase4-db";
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
    rating?: string;
  };

  if (!body.mealLogId || !body.studentEmail || !body.rating) {
    return NextResponse.json({ error: "參數不完整" }, { status: 400 });
  }

  if (!isValidCoachMealRating(body.rating)) {
    return NextResponse.json({ error: "無效評價標籤" }, { status: 400 });
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
    const rating = await insertMealRating(
      {
        mealLogId: body.mealLogId,
        coachEmail: session!.email,
        rating: body.rating,
      },
      { useServiceRole: true }
    );
    return NextResponse.json({ rating });
  } catch (error) {
    const readable = toReadableError(error, "評價儲存失敗");
    console.error("[coach/meal-rating] insert failed:", readable.message, error);
    return NextResponse.json(
      {
        error: readable.message,
        hint: "請在 Supabase 執行 supabase/meal-log-ratings.sql",
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

  const ratings = await fetchRatingsForMealIds(mealLogIds.filter(Boolean));
  return NextResponse.json({ ratings });
}
