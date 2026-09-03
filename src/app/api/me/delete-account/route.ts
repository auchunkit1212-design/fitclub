import { NextResponse } from "next/server";
import { adminDeleteUser } from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 登入用戶刪除自己嘅帳戶（App Store / GDPR 要求） */
export async function DELETE(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email?.trim()) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const email = session.email.trim().toLowerCase();

  if (email === SUPER_ADMIN_EMAIL || session.role === "admin") {
    return NextResponse.json(
      { error: "管理員帳戶請聯絡平台方處理刪除。" },
      { status: 403 }
    );
  }

  try {
    await adminDeleteUser(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除帳戶失敗";
    console.error("[me/delete-account]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
