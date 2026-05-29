import { NextResponse } from "next/server";
import { scanNutritionLabel } from "@/lib/vision-label";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as { imageBase64?: string };
  if (!body.imageBase64?.trim()) {
    return NextResponse.json({ error: "請上傳標籤相片" }, { status: 400 });
  }

  try {
    const result = await scanNutritionLabel(body.imageBase64);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "掃描失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
