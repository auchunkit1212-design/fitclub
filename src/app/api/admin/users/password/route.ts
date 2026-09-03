import { NextResponse } from "next/server";
import { adminSetUserPassword } from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email) {
    return NextResponse.json({ error: "請提供 email" }, { status: 400 });
  }

  try {
    await adminSetUserPassword(email, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "重設密碼失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
