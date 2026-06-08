import { NextResponse } from "next/server";
import { adminDeleteTenant } from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function DELETE(request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  const tenantId = context.params.id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "缺少健身室 ID" }, { status: 400 });
  }

  try {
    await adminDeleteTenant(tenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/tenants/delete]", error);
    const message =
      error instanceof Error ? error.message : "刪除健身室失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
