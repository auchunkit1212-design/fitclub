import { NextResponse } from "next/server";
import {
  fetchAllTenantsAdmin,
  fetchAllUsersAdmin,
} from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  try {
    const [users, tenants] = await Promise.all([
      fetchAllUsersAdmin(),
      fetchAllTenantsAdmin(),
    ]);
    return NextResponse.json({ users, tenants });
  } catch (error) {
    console.error("[admin/accounts]", error);
    return NextResponse.json({ error: "讀取帳戶列表失敗" }, { status: 500 });
  }
}
