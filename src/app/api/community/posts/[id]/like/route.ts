import { NextResponse } from "next/server";
import { toggleCommunityPostLike } from "@/lib/community-db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function POST(_request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(_request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const postId = context.params.id?.trim();
  if (!postId) {
    return NextResponse.json({ error: "缺少貼文 ID" }, { status: 400 });
  }

  try {
    const result = await toggleCommunityPostLike(postId, session.email);
    return NextResponse.json(result);
  } catch (error) {
    const readable = toReadableError(error, "讚好失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}
