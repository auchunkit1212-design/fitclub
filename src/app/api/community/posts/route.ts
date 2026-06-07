import { NextResponse } from "next/server";
import { insertCommunityPost } from "@/lib/community-db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";
import type { CommunityMediaType, CommunityPostKind } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readMacro(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    kind?: CommunityPostKind;
    bodyText?: string;
    mediaType?: CommunityMediaType;
    mediaUrl?: string;
    mealName?: string;
    calories?: unknown;
    protein?: unknown;
    carbs?: unknown;
    fats?: unknown;
  };

  const kind = body.kind === "meal" ? "meal" : "thought";
  const bodyText = typeof body.bodyText === "string" ? body.bodyText.trim() : "";
  const mediaUrl =
    typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";

  if (!bodyText && !mediaUrl && kind === "thought") {
    return NextResponse.json({ error: "請輸入文字或上傳媒體" }, { status: 400 });
  }

  try {
    const post = await insertCommunityPost({
      authorEmail: session.email,
      authorName: session.name,
      kind,
      bodyText: bodyText || undefined,
      mediaType: mediaUrl ? body.mediaType : undefined,
      mediaUrl: mediaUrl || undefined,
      mealName: typeof body.mealName === "string" ? body.mealName.trim() : undefined,
      calories: readMacro(body.calories),
      protein: readMacro(body.protein),
      carbs: readMacro(body.carbs),
      fats: readMacro(body.fats),
      tenantId: session.tenantId,
    });

    return NextResponse.json({ post });
  } catch (error) {
    const readable = toReadableError(error, "發布失敗");
    const status =
      error instanceof Error && error.message === "EMPTY_POST" ? 400 : 500;
    return NextResponse.json({ error: readable.message }, { status });
  }
}
