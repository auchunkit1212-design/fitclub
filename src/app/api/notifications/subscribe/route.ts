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

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[notifications/subscribe] supabase config", err);
    return NextResponse.json(
      {
        error: "伺服器未設定 Supabase",
        hint: "請在 Vercel / .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 及 SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 500 }
    );
  }

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
    const missingTable =
      error.code === "PGRST205" ||
      /push_subscriptions/i.test(error.message ?? "");
    return NextResponse.json(
      {
        error: missingTable
          ? "Supabase 未建立 push_subscriptions 表"
          : "訂閱儲存失敗",
        hint: missingTable
          ? "請到 Supabase → SQL Editor 貼上並執行專案內 supabase/push_subscriptions.sql"
          : "請確認 SUPABASE_SERVICE_ROLE_KEY 已設定，並檢查 Supabase 連線",
        code: error.code,
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
