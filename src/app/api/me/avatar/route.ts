import { NextRequest, NextResponse } from "next/server";
import {
  fetchUserAvatarUrl,
  updateUserAvatarUrl,
} from "@/lib/db";
import { isAllowedProfileAvatarUrl } from "@/lib/profile-avatar-storage";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionEmail(request: NextRequest): string | null {
  const session = parseSessionFromRequest(request);
  return session?.email?.trim().toLowerCase() ?? null;
}

export async function GET(request: NextRequest) {
  const email = sessionEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (parseSessionFromRequest(request)?.role === "admin") {
    return NextResponse.json({ avatarUrl: null });
  }

  try {
    const avatarUrl = await fetchUserAvatarUrl(email);
    return NextResponse.json({ avatarUrl });
  } catch (err) {
    console.error("[me/avatar GET]", err);
    return NextResponse.json(
      { error: "讀取頭像失敗" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const email = sessionEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (parseSessionFromRequest(request)?.role === "admin") {
    return NextResponse.json(
      { error: "總裁帳號請使用本機頭像" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as { avatarUrl?: string };
  const avatarUrl = body.avatarUrl?.trim();
  if (!avatarUrl || !isAllowedProfileAvatarUrl(avatarUrl)) {
    return NextResponse.json({ error: "無效的頭像網址" }, { status: 400 });
  }

  try {
    await updateUserAvatarUrl(email, avatarUrl);
    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error("[me/avatar PUT]", err);
    return NextResponse.json({ error: "儲存頭像失敗" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const email = sessionEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (parseSessionFromRequest(request)?.role === "admin") {
    return NextResponse.json({ ok: true, avatarUrl: null });
  }

  try {
    await updateUserAvatarUrl(email, null);
    return NextResponse.json({ ok: true, avatarUrl: null });
  } catch (err) {
    console.error("[me/avatar DELETE]", err);
    return NextResponse.json({ error: "刪除頭像失敗" }, { status: 500 });
  }
}
