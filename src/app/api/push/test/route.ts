import { NextRequest, NextResponse } from "next/server";
import { sendTestPushToAll } from "@/lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}

/** 手動測試推送（需 CRON_SECRET） */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendTestPushToAll();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push test failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
