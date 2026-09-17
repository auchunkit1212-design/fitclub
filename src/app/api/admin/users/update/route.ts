import { NextResponse } from "next/server";
import { adminUpdateUser, type AdminUserUpdateInput } from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  let body: AdminUserUpdateInput;
  try {
    body = (await request.json()) as AdminUserUpdateInput;
  } catch {
    return NextResponse.json({ error: "請提供有效 JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "請提供帳戶 Email" }, { status: 400 });
  }

  try {
    const user = await adminUpdateUser({ ...body, email });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
