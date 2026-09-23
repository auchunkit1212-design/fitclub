import { NextResponse } from "next/server";
import { fetchTenantsAdminSummary } from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  try {
    const tenants = await fetchTenantsAdminSummary();
    return NextResponse.json({ tenants });
  } catch (error) {
    console.error("[admin/tenants]", error);
    const message =
      error instanceof Error ? error.message : "讀取健身室列表失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
