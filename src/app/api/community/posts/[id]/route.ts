import { NextResponse } from "next/server";
import {
  deleteCommunityPostById,
  updateCommunityPostBody,
} from "@/lib/community-db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function PATCH(request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const postId = context.params.id?.trim();
  if (!postId) {
    return NextResponse.json({ error: "缺少貼文 ID" }, { status: 400 });
  }

  const body = (await request.json()) as { bodyText?: string };
  const bodyText = typeof body.bodyText === "string" ? body.bodyText : "";

  try {
    const post = await updateCommunityPostBody(
      postId,
      session.email,
      bodyText
    );
    if (!post) {
      return NextResponse.json({ error: "找不到貼文或無權限" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error) {
    const readable = toReadableError(error, "更新失敗");
    const status =
      error instanceof Error && error.message === "EMPTY_POST" ? 400 : 500;
    return NextResponse.json({ error: readable.message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(_request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const postId = context.params.id?.trim();
  if (!postId) {
    return NextResponse.json({ error: "缺少貼文 ID" }, { status: 400 });
  }

  try {
    const ok = await deleteCommunityPostById(postId, session.email);
    if (!ok) {
      return NextResponse.json({ error: "找不到貼文或無權限" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const readable = toReadableError(error, "刪除失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}
