import { NextRequest, NextResponse } from "next/server";
import { fetchAdminUserProfile } from "@/lib/admin-users";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  const email = new URL(request.url).searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json({ error: "請提供 email" }, { status: 400 });
  }

  try {
    const profile = await fetchAdminUserProfile(email);
    if (!profile) {
      return NextResponse.json({ error: "找不到帳戶" }, { status: 404 });
    }
    return NextResponse.json(profile, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[admin/users/profile]", error);
    return NextResponse.json({ error: "讀取帳戶資料失敗" }, { status: 500 });
  }
}
