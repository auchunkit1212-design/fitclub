import { NextResponse } from "next/server";
import {
  buildMonthlyLeaderboard,
  hongKongYearMonth,
} from "@/lib/leaderboard";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const now = hongKongYearMonth();
  const year = parseInt(params.get("year") ?? String(now.year), 10);
  const month = parseInt(params.get("month") ?? String(now.month), 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12 ||
    year < 2020 ||
    year > 2100
  ) {
    return NextResponse.json({ error: "無效的年月參數" }, { status: 400 });
  }

  try {
    const data = await buildMonthlyLeaderboard(session, year, month);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[leaderboard/month]", error);
    return NextResponse.json({ error: "載入排行榜失敗" }, { status: 500 });
  }
}
