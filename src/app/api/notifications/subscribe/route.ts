import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscribeBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
};

/** 儲存 Web Push 訂閱（教練 / 學員登入後由前端 POST） */
export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "缺少 endpoint 或 keys（p256dh / auth）" },
      { status: 400 }
    );
  }

  const email = session.email.trim().toLowerCase();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      email,
      endpoint,
      p256dh,
      auth,
      user_agent: body.userAgent?.slice(0, 500) ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[notifications/subscribe]", error);
    return NextResponse.json(
      {
        error: "訂閱儲存失敗",
        hint: "請在 Supabase 執行 supabase/push_subscriptions.sql",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, email });
}

/** 移除目前 endpoint 的訂閱 */
export async function DELETE(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let endpoint = "";
  try {
    const body = (await request.json()) as { endpoint?: string };
    endpoint = body.endpoint?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "請提供 endpoint" }, { status: 400 });
  }

  if (!endpoint) {
    return NextResponse.json({ error: "請提供 endpoint" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("email", session.email.trim().toLowerCase());

  if (error) {
    return NextResponse.json({ error: "刪除訂閱失敗" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
