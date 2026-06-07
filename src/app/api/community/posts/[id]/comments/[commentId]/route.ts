import { NextResponse } from "next/server";
import { deleteCommunityCommentById } from "@/lib/community-db";
import { toReadableError } from "@/lib/errors";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string; commentId: string } };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(_request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const commentId = context.params.commentId?.trim();
  if (!commentId) {
    return NextResponse.json({ error: "缺少留言 ID" }, { status: 400 });
  }

  try {
    const deleted = await deleteCommunityCommentById(commentId, session.email);
    if (!deleted) {
      return NextResponse.json({ error: "找不到留言或無權限" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const readable = toReadableError(error, "刪除留言失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}
