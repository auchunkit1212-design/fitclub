import { readApiJson } from "@/lib/api-client";
import {
  isRemoteCommunityMediaUrl,
  uploadCommunityMediaFromClient,
} from "@/lib/community-media-storage";
import {
  COMMUNITY_DEMO_POSTS,
  loadCommunityFeed as loadLocalCommunityFeed,
  type CommunityComment,
  type CommunityFeedPost,
  type CommunityMediaType,
} from "@/lib/community";
import { getSessionRequestHeaders } from "@/lib/session";
import type { UserSession } from "@/lib/types";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...getSessionRequestHeaders(),
  };
}

export type CommunityFeedResult = {
  posts: CommunityFeedPost[];
  source: "cloud" | "local";
};

export async function fetchCommunityFeedCloud(): Promise<CommunityFeedResult> {
  try {
    const res = await fetch("/api/community/feed", {
      credentials: "include",
      headers: getSessionRequestHeaders(),
    });
    const { data, parseError } = await readApiJson<{
      posts?: CommunityFeedPost[];
      error?: string;
    }>(res);

    if (!res.ok || parseError || !data?.posts) {
      throw new Error(data?.error ?? `HTTP ${res.status}`);
    }

    return { posts: data.posts, source: "cloud" };
  } catch (err) {
    console.warn("[community-client] cloud feed failed, using local", err);
    return { posts: loadLocalCommunityFeed(), source: "local" };
  }
}

async function resolveMediaUrl(
  session: Pick<UserSession, "email">,
  mediaType: CommunityMediaType | undefined,
  mediaUrl: string | undefined
): Promise<string | undefined> {
  if (!mediaUrl?.trim()) return undefined;
  if (isRemoteCommunityMediaUrl(mediaUrl)) return mediaUrl;
  if (!mediaType) return mediaUrl;
  return uploadCommunityMediaFromClient(session.email, mediaUrl, mediaType);
}

export async function publishThoughtPostCloud(input: {
  session: Pick<UserSession, "email" | "name" | "tenantId">;
  bodyText: string;
  mediaType?: CommunityMediaType;
  mediaUrl?: string;
}): Promise<CommunityFeedPost> {
  const text = input.bodyText.trim();
  const resolvedMedia = await resolveMediaUrl(
    input.session,
    input.mediaType,
    input.mediaUrl
  );

  if (!text && !resolvedMedia) {
    throw new Error("EMPTY_POST");
  }

  const res = await fetch("/api/community/posts", {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({
      kind: "thought",
      bodyText: text,
      mediaType: resolvedMedia ? input.mediaType : undefined,
      mediaUrl: resolvedMedia,
    }),
  });

  const { data, parseError } = await readApiJson<{
    post?: CommunityFeedPost;
    error?: string;
  }>(res);

  if (!res.ok || parseError || !data?.post) {
    throw new Error(data?.error ?? `發布失敗 (HTTP ${res.status})`);
  }

  return data.post;
}

export async function publishMealSharePostCloud(input: {
  session: Pick<UserSession, "email" | "name" | "tenantId">;
  mealType: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  imageUrl?: string;
  caption?: string;
}): Promise<CommunityFeedPost> {
  const mealName = `${input.mealType} · ${input.description.trim()}`;
  let mediaUrl = input.imageUrl?.trim();

  if (mediaUrl && !isRemoteCommunityMediaUrl(mediaUrl)) {
    mediaUrl = await uploadCommunityMediaFromClient(
      input.session.email,
      mediaUrl,
      "image"
    );
  }

  const res = await fetch("/api/community/posts", {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({
      kind: "meal",
      bodyText: input.caption?.trim(),
      mediaType: mediaUrl ? "image" : undefined,
      mediaUrl,
      mealName,
      calories: Math.round(input.calories),
      protein: Math.round(input.protein),
      carbs: Math.round(input.carbs),
      fats: Math.round(input.fats),
    }),
  });

  const { data, parseError } = await readApiJson<{
    post?: CommunityFeedPost;
    error?: string;
  }>(res);

  if (!res.ok || parseError || !data?.post) {
    throw new Error(data?.error ?? `分享失敗 (HTTP ${res.status})`);
  }

  return data.post;
}

export async function deleteCommunityPostCloud(
  postId: string
): Promise<void> {
  const res = await fetch(`/api/community/posts/${postId}`, {
    method: "DELETE",
    credentials: "include",
    headers: getSessionRequestHeaders(),
  });
  const { data, parseError } = await readApiJson<{ error?: string }>(res);
  if (!res.ok || parseError) {
    throw new Error(data?.error ?? `刪除失敗 (HTTP ${res.status})`);
  }
}

export async function updateCommunityPostCloud(
  postId: string,
  bodyText: string
): Promise<void> {
  const res = await fetch(`/api/community/posts/${postId}`, {
    method: "PATCH",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ bodyText }),
  });
  const { data, parseError } = await readApiJson<{ error?: string }>(res);
  if (!res.ok || parseError) {
    throw new Error(data?.error ?? `更新失敗 (HTTP ${res.status})`);
  }
}

export async function toggleCommunityLikeCloud(
  postId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const res = await fetch(`/api/community/posts/${postId}/like`, {
    method: "POST",
    credentials: "include",
    headers: getSessionRequestHeaders(),
  });
  const { data, parseError } = await readApiJson<{
    liked?: boolean;
    likeCount?: number;
    error?: string;
  }>(res);

  if (!res.ok || parseError) {
    throw new Error(data?.error ?? `讚好失敗 (HTTP ${res.status})`);
  }

  return {
    liked: Boolean(data?.liked),
    likeCount: Number(data?.likeCount) || 0,
  };
}

export async function fetchCommunityCommentsCloud(
  postId: string
): Promise<CommunityComment[]> {
  const res = await fetch(`/api/community/posts/${postId}/comments`, {
    credentials: "include",
    headers: getSessionRequestHeaders(),
  });
  const { data, parseError } = await readApiJson<{
    comments?: CommunityComment[];
    error?: string;
  }>(res);

  if (!res.ok || parseError) {
    throw new Error(data?.error ?? `讀取留言失敗 (HTTP ${res.status})`);
  }

  return data?.comments ?? [];
}

export async function postCommunityCommentCloud(
  postId: string,
  bodyText: string
): Promise<CommunityComment> {
  const res = await fetch(`/api/community/posts/${postId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ bodyText }),
  });
  const { data, parseError } = await readApiJson<{
    comment?: CommunityComment;
    error?: string;
  }>(res);

  if (!res.ok || parseError || !data?.comment) {
    throw new Error(data?.error ?? `留言失敗 (HTTP ${res.status})`);
  }

  return data.comment;
}

export async function deleteCommunityCommentCloud(
  postId: string,
  commentId: string
): Promise<void> {
  const res = await fetch(
    `/api/community/posts/${postId}/comments/${commentId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: getSessionRequestHeaders(),
    }
  );
  const { data, parseError } = await readApiJson<{ error?: string }>(res);
  if (!res.ok || parseError) {
    throw new Error(data?.error ?? `刪除留言失敗 (HTTP ${res.status})`);
  }
}

export function getCommunityDemoPostsForEmptyState(): CommunityFeedPost[] {
  return COMMUNITY_DEMO_POSTS;
}
