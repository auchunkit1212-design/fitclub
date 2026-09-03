import { NextResponse } from "next/server";
import { adminDeleteUser } from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  const email =
    new URL(request.url).searchParams.get("email")?.trim() ?? "";

  if (!email) {
    return NextResponse.json({ error: "請提供 email" }, { status: 400 });
  }

  try {
    await adminDeleteUser(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除帳戶失敗";
    console.error("[admin/users/delete]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
