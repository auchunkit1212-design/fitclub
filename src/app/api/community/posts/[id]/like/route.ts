import { NextResponse } from "next/server";
import {
  fetchCommunityPostById,
  toggleCommunityPostLike,
} from "@/lib/community-db";
import { notifyAuthorOfCommunityLike } from "@/lib/community-notifications";
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

    if (result.liked) {
      const post = await fetchCommunityPostById(postId);
      if (post) {
        notifyAuthorOfCommunityLike({
          authorEmail: post.author_email,
          likerName: session.name || "學員",
          likerEmail: session.email,
          postId,
        }).catch((err) => {
          console.warn("[community/like] push failed (ignored):", err);
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const readable = toReadableError(error, "讚好失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}
