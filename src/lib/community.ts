import { getProfilePhotoUrl } from "@/lib/profile-photo";
import type { UserSession } from "@/lib/types";

const STORAGE_KEY = "fitclub_community_posts_v1";
const MAX_STORED_POSTS = 80;
const MAX_VIDEO_BYTES = 6 * 1024 * 1024;

export type CommunityMediaType = "image" | "video";

export type CommunityPostKind = "thought" | "meal";

export type CommunityFeedPost = {
  id: string;
  kind: CommunityPostKind;
  authorEmail: string;
  authorName: string;
  authorInitials: string;
  avatarHue: string;
  /** 發文時的快照；雲端頭像為 https URL，跨裝置可顯示 */
  authorAvatarUrl?: string;
  createdAt: string;
  postedAt: string;
  bodyText?: string;
  mediaType?: CommunityMediaType;
  mediaUrl?: string;
  mealName?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  likes: number;
  likedByMe?: boolean;
  isDemo?: boolean;
};

const AVATAR_HUES = [
  "bg-sky-500",
  "bg-rose-400",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-violet-500",
  "bg-teal-500",
];

export function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2);
}

export function avatarHueForEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash + email.charCodeAt(i) * (i + 1)) % AVATAR_HUES.length;
  }
  return AVATAR_HUES[hash] ?? AVATAR_HUES[0];
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "剛剛";
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "剛剛";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小時前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} 日前`;
  return new Date(iso).toLocaleDateString("zh-HK", {
    month: "short",
    day: "numeric",
  });
}

function newPostId(): string {
  return `post-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readStoredPosts(): CommunityFeedPost[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommunityFeedPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredPosts(posts: CommunityFeedPost[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(posts.slice(0, MAX_STORED_POSTS))
    );
  } catch (err) {
    console.warn("[community] localStorage write failed", err);
    throw new Error("STORAGE_FULL");
  }
}

function authorAvatarSnapshot(email: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = getProfilePhotoUrl(email);
  return url?.trim() || undefined;
}

function authorFromSession(session: Pick<UserSession, "email" | "name">) {
  const email = session.email.trim().toLowerCase();
  const authorName = session.name?.trim() || email.split("@")[0] || "學員";
  return {
    authorEmail: email,
    authorName,
    authorInitials: initialsFromName(authorName),
    avatarHue: avatarHueForEmail(email),
    authorAvatarUrl: authorAvatarSnapshot(email),
  };
}

function appendPost(post: CommunityFeedPost): CommunityFeedPost {
  const existing = readStoredPosts();
  writeStoredPosts([post, ...existing]);
  return post;
}

export function publishThoughtPost(input: {
  session: Pick<UserSession, "email" | "name">;
  bodyText: string;
  mediaType?: CommunityMediaType;
  mediaUrl?: string;
}): CommunityFeedPost {
  const text = input.bodyText.trim();
  if (!text && !input.mediaUrl) {
    throw new Error("EMPTY_POST");
  }
  const createdAt = new Date().toISOString();
  const post: CommunityFeedPost = {
    id: newPostId(),
    kind: "thought",
    ...authorFromSession(input.session),
    createdAt,
    postedAt: formatRelativeTime(createdAt),
    bodyText: text || undefined,
    mediaType: input.mediaUrl ? input.mediaType : undefined,
    mediaUrl: input.mediaUrl,
    likes: 0,
  };
  return appendPost(post);
}

export function publishMealSharePost(input: {
  session: Pick<UserSession, "email" | "name">;
  mealType: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  imageUrl?: string;
  caption?: string;
}): CommunityFeedPost {
  const createdAt = new Date().toISOString();
  const mealName = `${input.mealType} · ${input.description.trim()}`;
  const post: CommunityFeedPost = {
    id: newPostId(),
    kind: "meal",
    ...authorFromSession(input.session),
    createdAt,
    postedAt: formatRelativeTime(createdAt),
    bodyText: input.caption?.trim() || undefined,
    mediaType: input.imageUrl ? "image" : undefined,
    mediaUrl: input.imageUrl,
    mealName,
    calories: Math.round(input.calories),
    protein: Math.round(input.protein),
    carbs: Math.round(input.carbs),
    fats: Math.round(input.fats),
    likes: 0,
  };
  return appendPost(post);
}

export const COMMUNITY_DEMO_POSTS: CommunityFeedPost[] = [
  {
    id: "demo-1",
    kind: "meal",
    authorEmail: "demo@fitclub.hk",
    authorName: "阿 Ken",
    authorInitials: "K",
    avatarHue: "bg-sky-500",
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    postedAt: "12 分鐘前",
    mealName: "午餐 · 雞胸沙律碗",
    mediaUrl:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
    mediaType: "image",
    calories: 420,
    protein: 38,
    carbs: 32,
    fats: 14,
    likes: 24,
    isDemo: true,
  },
  {
    id: "demo-2",
    kind: "thought",
    authorEmail: "demo2@fitclub.hk",
    authorName: "Mandy",
    authorInitials: "M",
    avatarHue: "bg-rose-400",
    createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    postedAt: "1 小時前",
    bodyText: "今日試咗高蛋白早餐，精神好咗好多！",
    calories: undefined,
    protein: undefined,
    carbs: undefined,
    fats: undefined,
    likes: 11,
    isDemo: true,
  },
  {
    id: "demo-3",
    kind: "meal",
    authorEmail: "demo3@fitclub.hk",
    authorName: "Jason 教練",
    authorInitials: "J",
    avatarHue: "bg-emerald-600",
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    postedAt: "2 小時前",
    mealName: "早餐 · 高蛋白早餐盤",
    mediaUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80",
    mediaType: "image",
    calories: 510,
    protein: 42,
    carbs: 28,
    fats: 22,
    likes: 56,
    isDemo: true,
  },
];

export function isCommunityPostOwner(
  post: CommunityFeedPost,
  userEmail: string
): boolean {
  if (post.isDemo) return false;
  return (
    post.authorEmail.trim().toLowerCase() ===
    userEmail.trim().toLowerCase()
  );
}

export function deleteCommunityPost(
  postId: string,
  authorEmail: string
): boolean {
  const email = authorEmail.trim().toLowerCase();
  const posts = readStoredPosts();
  const next = posts.filter(
    (p) => !(p.id === postId && p.authorEmail.trim().toLowerCase() === email)
  );
  if (next.length === posts.length) return false;
  writeStoredPosts(next);
  return true;
}

export function updateCommunityPost(
  postId: string,
  authorEmail: string,
  patch: { bodyText: string }
): CommunityFeedPost | null {
  const email = authorEmail.trim().toLowerCase();
  const text = patch.bodyText.trim();
  const posts = readStoredPosts();
  const idx = posts.findIndex(
    (p) => p.id === postId && p.authorEmail.trim().toLowerCase() === email
  );
  if (idx < 0) return null;

  const current = posts[idx];
  if (current.kind === "thought" && !text && !current.mediaUrl) {
    throw new Error("EMPTY_POST");
  }

  const updated: CommunityFeedPost = {
    ...current,
    bodyText: text || undefined,
    postedAt: formatRelativeTime(current.createdAt),
  };
  posts[idx] = updated;
  writeStoredPosts(posts);
  return updated;
}

export function loadCommunityFeed(now = Date.now()): CommunityFeedPost[] {
  const stored = readStoredPosts().map((p) => ({
    ...p,
    postedAt: formatRelativeTime(p.createdAt, now),
  }));
  if (stored.length > 0) return stored;
  return COMMUNITY_DEMO_POSTS.map((p) => ({
    ...p,
    postedAt: formatRelativeTime(p.createdAt, now),
  }));
}

export function validateVideoFile(file: File): string | null {
  if (!file.type.startsWith("video/")) return "請選擇影片檔案";
  if (file.size > MAX_VIDEO_BYTES) {
    return `影片請小於 ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB`;
  }
  return null;
}
