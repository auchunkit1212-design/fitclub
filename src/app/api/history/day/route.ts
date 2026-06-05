import { NextResponse } from "next/server";
import { fetchHistoryDayDetail } from "@/lib/history-calendar";
import { parseSessionFromRequest } from "@/lib/session-server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  if (session.role !== "student") {
    return NextResponse.json({ error: "僅學員可查看歷史紀錄" }, { status: 403 });
  }

  const date = new URL(request.url).searchParams.get("date")?.trim() ?? "";
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "無效的日期參數" }, { status: 400 });
  }

  try {
    const data = await fetchHistoryDayDetail(session.email, date);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[history/day]", error);
    return NextResponse.json({ error: "載入當日紀錄失敗" }, { status: 500 });
  }
}
