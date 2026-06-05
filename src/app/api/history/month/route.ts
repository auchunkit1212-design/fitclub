import { NextResponse } from "next/server";
import { fetchHistoryMonthSummary } from "@/lib/history-calendar";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  if (session.role !== "student") {
    return NextResponse.json({ error: "僅學員可查看歷史紀錄" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const year = parseInt(params.get("year") ?? "", 10);
  const month = parseInt(params.get("month") ?? "", 10);

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
    const data = await fetchHistoryMonthSummary(session.email, year, month);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[history/month]", error);
    return NextResponse.json({ error: "載入歷史紀錄失敗" }, { status: 500 });
  }
}
