import { NextResponse } from "next/server";
import { syncCheckoutSessionToUser } from "@/lib/stripe-billing";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 付款成功頁補同步（Webhook 延遲或未設定時） */
export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  let sessionId = "";
  try {
    const body = (await request.json()) as { sessionId?: string };
    sessionId = body.sessionId?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  try {
    const result = await syncCheckoutSessionToUser(
      sessionId,
      session.email
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "同步失敗" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "同步 Checkout 失敗";
    console.error("[stripe/confirm-checkout]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
