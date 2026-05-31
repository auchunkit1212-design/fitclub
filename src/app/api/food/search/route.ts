import { NextResponse } from "next/server";
import { searchFoodDatabase } from "@/lib/edamam";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const items = await searchFoodDatabase(q);
  return NextResponse.json({ items, source: process.env.EDAMAM_APP_ID ? "edamam" : "mock" });
}
