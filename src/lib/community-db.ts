import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  avatarHueForEmail,
  formatRelativeTime,
  initialsFromName,
  type CommunityComment,
  type CommunityFeedPost,
  type CommunityMediaType,
  type CommunityPostKind,
} from "@/lib/community";
import { fetchUserByEmail } from "@/lib/db";

export type CommunityPostRow = {
  id: string;
  author_email: string;
  author_name: string;
  kind: CommunityPostKind;
  body_text: string | null;
  media_type: CommunityMediaType | null;
  media_url: string | null;
  meal_name: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCommunityPostInput = {
  authorEmail: string;
  authorName: string;
  kind: CommunityPostKind;
  bodyText?: string;
  mediaType?: CommunityMediaType;
  mediaUrl?: string;
  mealName?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  tenantId?: string;
};

function readMacro(value: number | null | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.round(value);
}

function rowToFeedPost(
  row: CommunityPostRow,
  likeCount: number,
  likedByMe: boolean,
  authorAvatarUrl?: string | null,
  commentCount = 0,
  now = Date.now()
): CommunityFeedPost {
  const authorEmail = row.author_email.trim().toLowerCase();
  const authorName = row.author_name.trim() || authorEmail.split("@")[0];

  return {
    id: row.id,
    kind: row.kind,
    authorEmail,
    authorName,
    authorInitials: initialsFromName(authorName),
    avatarHue: avatarHueForEmail(authorEmail),
    authorAvatarUrl: authorAvatarUrl?.trim() || undefined,
    createdAt: row.created_at,
    postedAt: formatRelativeTime(row.created_at, now),
    bodyText: row.body_text?.trim() || undefined,
    mediaType: row.media_type ?? undefined,
    mediaUrl: row.media_url?.trim() || undefined,
    mealName: row.meal_name?.trim() || undefined,
    calories: readMacro(row.calories),
    protein: readMacro(row.protein),
    carbs: readMacro(row.carbs),
    fats: readMacro(row.fats),
    likes: likeCount,
    likedByMe,
    commentCount,
    isDemo: false,
  };
}

function rowToComment(
  row: {
    id: string;
    post_id: string;
    author_email: string;
    author_name: string;
    body_text: string;
    created_at: string;
  },
  now = Date.now()
): CommunityComment {
  const authorEmail = row.author_email.trim().toLowerCase();
  const authorName = row.author_name.trim() || authorEmail.split("@")[0];
  return {
    id: row.id,
    postId: row.post_id,
    authorEmail,
    authorName,
    authorInitials: initialsFromName(authorName),
    avatarHue: avatarHueForEmail(authorEmail),
    bodyText: row.body_text.trim(),
    createdAt: row.created_at,
    postedAt: formatRelativeTime(row.created_at, now),
  };
}

async function fetchAvatarMap(
  emails: string[]
): Promise<Map<string, string | null>> {
  const unique = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  );
  const map = new Map<string, string | null>();
  await Promise.all(
    unique.map(async (email) => {
      const user = await fetchUserByEmail(email);
      map.set(email, user?.avatarUrl?.trim() || null);
    })
  );
  return map;
}

export async function fetchCommunityFeed(input: {
  viewerEmail: string;
  tenantId?: string;
  limit?: number;
}): Promise<CommunityFeedPost[]> {
  const client = getSupabaseAdmin();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 80);

  let query = client
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.tenantId?.trim()) {
    query = query.eq("tenant_id", input.tenantId.trim());
  }

  const { data: rows, error } = await query;
  if (error) {
    throw new Error(
      `community_posts 讀取失敗：${error.message}（請執行 supabase/community-posts.sql）`
    );
  }

  const posts = (rows ?? []) as CommunityPostRow[];
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const viewer = input.viewerEmail.trim().toLowerCase();

  const { data: likeRows, error: likeError } = await client
    .from("community_post_likes")
    .select("post_id, user_email")
    .in("post_id", postIds);

  if (likeError) {
    throw new Error(`community_post_likes 讀取失敗：${likeError.message}`);
  }

  const likeCountMap = new Map<string, number>();
  const likedSet = new Set<string>();

  for (const row of likeRows ?? []) {
    const postId = String((row as { post_id: string }).post_id);
    likeCountMap.set(postId, (likeCountMap.get(postId) ?? 0) + 1);
    const userEmail = String((row as { user_email: string }).user_email)
      .trim()
      .toLowerCase();
    if (userEmail === viewer) likedSet.add(postId);
  }

  const now = Date.now();
  const commentCountMap = new Map<string, number>();
  const commentsByPost = new Map<string, CommunityComment[]>();
  const { data: commentRows, error: commentError } = await client
    .from("community_post_comments")
    .select("*")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (!commentError) {
    for (const row of commentRows ?? []) {
      const typed = row as {
        id: string;
        post_id: string;
        author_email: string;
        author_name: string;
        body_text: string;
        created_at: string;
      };
      const postId = String(typed.post_id);
      commentCountMap.set(postId, (commentCountMap.get(postId) ?? 0) + 1);
      const list = commentsByPost.get(postId) ?? [];
      list.push(rowToComment(typed, now));
      commentsByPost.set(postId, list);
    }
  }

  const avatarMap = await fetchAvatarMap(posts.map((p) => p.author_email));

  return posts.map((row) => ({
    ...rowToFeedPost(
      row,
      likeCountMap.get(row.id) ?? 0,
      likedSet.has(row.id),
      avatarMap.get(row.author_email.trim().toLowerCase()),
      commentCountMap.get(row.id) ?? 0,
      now
    ),
    comments: commentsByPost.get(row.id) ?? [],
  }));
}

export async function fetchCommunityPostById(
  postId: string
): Promise<CommunityPostRow | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as CommunityPostRow | null) ?? null;
}

export async function fetchCommunityCommentsForPost(
  postId: string
): Promise<CommunityComment[]> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("community_post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `community_post_comments 讀取失敗：${error.message}（請執行 supabase/community-post-comments.sql）`
    );
  }

  const now = Date.now();
  return (data ?? []).map((row) =>
    rowToComment(
      row as {
        id: string;
        post_id: string;
        author_email: string;
        author_name: string;
        body_text: string;
        created_at: string;
      },
      now
    )
  );
}

export async function insertCommunityComment(input: {
  postId: string;
  authorEmail: string;
  authorName: string;
  bodyText: string;
}): Promise<CommunityComment> {
  const client = getSupabaseAdmin();
  const email = input.authorEmail.trim().toLowerCase();
  const authorName = input.authorName.trim() || email.split("@")[0];
  const text = input.bodyText.trim();
  if (!text) throw new Error("EMPTY_COMMENT");

  const post = await fetchCommunityPostById(input.postId);
  if (!post) throw new Error("POST_NOT_FOUND");

  const { data, error } = await client
    .from("community_post_comments")
    .insert({
      post_id: input.postId,
      author_email: email,
      author_name: authorName,
      body_text: text,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "留言失敗（請執行 supabase/community-post-comments.sql）"
    );
  }

  return rowToComment(
    data as {
      id: string;
      post_id: string;
      author_email: string;
      author_name: string;
      body_text: string;
      created_at: string;
    }
  );
}

export async function deleteCommunityCommentById(
  commentId: string,
  authorEmail: string
): Promise<boolean> {
  const client = getSupabaseAdmin();
  const email = authorEmail.trim().toLowerCase();

  const { data: existing, error: fetchError } = await client
    .from("community_post_comments")
    .select("id")
    .eq("id", commentId)
    .eq("author_email", email)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) return false;

  const { error } = await client
    .from("community_post_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_email", email);

  if (error) throw new Error(error.message);
  return true;
}

export async function insertCommunityPost(
  input: CreateCommunityPostInput
): Promise<CommunityFeedPost> {
  const client = getSupabaseAdmin();
  const authorEmail = input.authorEmail.trim().toLowerCase();
  const authorName = input.authorName.trim() || authorEmail.split("@")[0];

  const { data, error } = await client
    .from("community_posts")
    .insert({
      author_email: authorEmail,
      author_name: authorName,
      kind: input.kind,
      body_text: input.bodyText?.trim() || null,
      media_type: input.mediaUrl ? input.mediaType ?? null : null,
      media_url: input.mediaUrl?.trim() || null,
      meal_name: input.mealName?.trim() || null,
      calories: input.calories ?? null,
      protein: input.protein ?? null,
      carbs: input.carbs ?? null,
      fats: input.fats ?? null,
      tenant_id: input.tenantId?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `發布失敗：${error?.message ?? "unknown"}（請執行 supabase/community-posts.sql）`
    );
  }

  const user = await fetchUserByEmail(authorEmail);
  return rowToFeedPost(data as CommunityPostRow, 0, false, user?.avatarUrl);
}

export async function updateCommunityPostBody(
  postId: string,
  authorEmail: string,
  bodyText: string
): Promise<CommunityFeedPost | null> {
  const client = getSupabaseAdmin();
  const email = authorEmail.trim().toLowerCase();
  const text = bodyText.trim();

  const { data: existing, error: fetchError } = await client
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .eq("author_email", email)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) return null;

  const row = existing as CommunityPostRow;
  if (row.kind === "thought" && !text && !row.media_url) {
    throw new Error("EMPTY_POST");
  }

  const { data, error } = await client
    .from("community_posts")
    .update({
      body_text: text || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("author_email", email)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "更新失敗");

  const user = await fetchUserByEmail(email);
  return rowToFeedPost(data as CommunityPostRow, 0, false, user?.avatarUrl);
}

export async function deleteCommunityPostById(
  postId: string,
  authorEmail: string
): Promise<boolean> {
  const client = getSupabaseAdmin();
  const email = authorEmail.trim().toLowerCase();

  const { data: existing, error: fetchError } = await client
    .from("community_posts")
    .select("id")
    .eq("id", postId)
    .eq("author_email", email)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) return false;

  const { error } = await client
    .from("community_posts")
    .delete()
    .eq("id", postId)
    .eq("author_email", email);

  if (error) throw new Error(error.message);
  return true;
}

export async function toggleCommunityPostLike(
  postId: string,
  userEmail: string
): Promise<{ liked: boolean; likeCount: number }> {
  const client = getSupabaseAdmin();
  const email = userEmail.trim().toLowerCase();

  const { data: existing, error: fetchError } = await client
    .from("community_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_email", email)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  if (existing) {
    const { error } = await client
      .from("community_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_email", email);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("community_post_likes").insert({
      post_id: postId,
      user_email: email,
    });
    if (error) throw new Error(error.message);
  }

  const { count, error: countError } = await client
    .from("community_post_likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  if (countError) throw new Error(countError.message);

  return { liked: !existing, likeCount: count ?? 0 };
}
