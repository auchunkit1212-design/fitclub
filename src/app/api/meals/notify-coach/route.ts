import { NextResponse } from "next/server";
import { notifyCoachOfNewMealLog } from "@/lib/meal-notifications";
import { parseSessionFromRequest } from "@/lib/session-server";
import type { MealLog } from "@/lib/types";

export const runtime = "nodejs";

/** 客戶端直接寫入 meal_logs 後，補發教練推播（例如 API 失敗 fallback） */
export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { log?: MealLog };
  try {
    body = (await request.json()) as { log?: MealLog };
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const log = body.log;
  if (
    !log?.id ||
    !log.email ||
    log.email.trim().toLowerCase() !== session.email.trim().toLowerCase()
  ) {
    return NextResponse.json({ error: "無效的飲食紀錄" }, { status: 400 });
  }

  try {
    const result = await notifyCoachOfNewMealLog(log);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.warn("[meals/notify-coach] failed:", error);
    return NextResponse.json(
      {
        error: "教練推播發送失敗",
        hint: "請確認教練已在後台開啟推播，並已執行 supabase/push_subscriptions.sql",
      },
      { status: 500 }
    );
  }
}
