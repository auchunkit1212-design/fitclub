import { NextResponse } from "next/server";
import { syncStripeBillingForUser } from "@/lib/stripe-billing";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = body.email?.trim().toLowerCase() ?? "";
  } catch {
    return NextResponse.json({ error: "請提供 email" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "請提供 email" }, { status: 400 });
  }

  try {
    const result = await syncStripeBillingForUser(email);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "同步失敗" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      stripeCustomerId: result.customerId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失敗";
    console.error("[admin/users/sync-stripe]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
