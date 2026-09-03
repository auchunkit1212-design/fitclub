import { NextResponse } from "next/server";
import {
  fetchCommunityCommentsForPost,
  fetchCommunityPostById,
  insertCommunityComment,
} from "@/lib/community-db";
import {
  notifyAuthorOfCommunityComment,
} from "@/lib/community-notifications";
import { toReadableError } from "@/lib/errors";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(_request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const postId = context.params.id?.trim();
  if (!postId) {
    return NextResponse.json({ error: "缺少貼文 ID" }, { status: 400 });
  }

  try {
    const comments = await fetchCommunityCommentsForPost(postId);
    return NextResponse.json({ comments });
  } catch (error) {
    const readable = toReadableError(error, "讀取留言失敗");
    return NextResponse.json(
      {
        error: readable.message,
        hint: "請在 Supabase 執行 supabase/community-post-comments.sql",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const postId = context.params.id?.trim();
  if (!postId) {
    return NextResponse.json({ error: "缺少貼文 ID" }, { status: 400 });
  }

  const body = (await request.json()) as { bodyText?: string };
  const text = body.bodyText?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "請輸入留言內容" }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "留言不可超過 500 字" }, { status: 400 });
  }

  try {
    const comment = await insertCommunityComment({
      postId,
      authorEmail: session.email,
      authorName: session.name || session.email.split("@")[0],
      bodyText: text,
    });

    const post = await fetchCommunityPostById(postId);
    if (post) {
      notifyAuthorOfCommunityComment({
        authorEmail: post.author_email,
        commenterName: session.name || "學員",
        commenterEmail: session.email,
        postId,
        commentText: text,
      }).catch((err) => {
        console.warn("[community/comments] push failed (ignored):", err);
      });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    const readable = toReadableError(error, "留言失敗");
    if (readable.message === "POST_NOT_FOUND") {
      return NextResponse.json({ error: "找不到貼文" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: readable.message,
        hint: "請在 Supabase 執行 supabase/community-post-comments.sql",
      },
      { status: 500 }
    );
  }
}
