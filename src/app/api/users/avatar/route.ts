import { NextRequest, NextResponse } from "next/server";
import { fetchUserAvatarUrl } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 公開讀取 registry 內頭像 URL（供社群動態顯示其他用戶頭像） */
export async function GET(request: NextRequest) {
  const email = new URL(request.url).searchParams
    .get("email")
    ?.trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const avatarUrl = await fetchUserAvatarUrl(email);
    return NextResponse.json({ avatarUrl });
  } catch (err) {
    console.error("[users/avatar]", err);
    return NextResponse.json({ error: "讀取失敗" }, { status: 500 });
  }
}
