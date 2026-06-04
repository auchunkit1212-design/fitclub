import { NextResponse } from "next/server";
import { adminReassignStudentToTenant } from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  let body: { email?: string; tenantId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "請提供有效 JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const tenantId = body.tenantId?.trim();
  if (!email || !tenantId) {
    return NextResponse.json(
      { error: "請提供學員 email 與目標健身室" },
      { status: 400 }
    );
  }

  try {
    const user = await adminReassignStudentToTenant(email, tenantId);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "調配失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
