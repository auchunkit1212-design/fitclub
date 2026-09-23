import { fetchReviewIndexForMealIds } from "@/lib/coach-review-index";
import { NextResponse } from "next/server";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { mealLogIds?: unknown };
  try {
    body = (await request.json()) as { mealLogIds?: unknown };
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const ids = Array.isArray(body.mealLogIds)
    ? body.mealLogIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    : [];

  const { reactions, feedback } = await fetchReviewIndexForMealIds(ids);
  return NextResponse.json({ reactions, feedback });
}
