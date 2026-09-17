"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, MoreVertical, Pencil, Trash2 } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import {
  deleteCommunityPost,
  isCommunityPostOwner,
  updateCommunityPost,
  type CommunityComment,
  type CommunityFeedPost,
} from "@/lib/community";
import {
  deleteCommunityCommentCloud,
  deleteCommunityPostCloud,
  fetchCommunityCommentsCloud,
  postCommunityCommentCloud,
  toggleCommunityLikeCloud,
  updateCommunityPostCloud,
} from "@/lib/community-client";
import { fetchPublicAvatarUrl } from "@/lib/profile-avatar-client";
import { getProfilePhotoUrl } from "@/lib/profile-photo";

const SOFT_CARD =
  "w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden min-w-0";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  post: CommunityFeedPost;
  currentUserEmail?: string;
  feedSource?: "cloud" | "local";
  onPostChanged?: () => void;
};

function MacroTag({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
      <span className="text-emerald-600">{label}</span>
      {value}
      {unit}
    </span>
  );
}

export function CommunityFeedCard({
  post,
  currentUserEmail,
  feedSource = "cloud",
  onPostChanged,
}: Props) {
  const { t } = useI18n();
  const [liked, setLiked] = useState(post.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(
    post.commentCount ?? post.comments?.length ?? 0
  );
  const [comments, setComments] = useState<CommunityComment[]>(
    post.comments ?? []
  );
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.bodyText ?? "");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner =
    currentUserEmail != null && isCommunityPostOwner(post, currentUserEmail);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!editing) setEditText(post.bodyText ?? "");
  }, [post.bodyText, editing]);

  useEffect(() => {
    setLiked(post.likedByMe ?? false);
    setLikeCount(post.likes);
    setCommentCount(post.commentCount ?? post.comments?.length ?? 0);
    setComments(post.comments ?? []);
    setCommentText("");
  }, [
    post.id,
    post.likedByMe,
    post.likes,
    post.commentCount,
    post.comments,
  ]);

  useEffect(() => {
    if (post.isDemo || feedSource !== "cloud" || post.comments != null) return;
    let cancelled = false;
    setCommentsLoading(true);
    void fetchCommunityCommentsCloud(post.id)
      .then((rows) => {
        if (cancelled) return;
        setComments(rows);
        setCommentCount(rows.length);
      })
      .catch(() => {
        // keep existing count
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feedSource, post.comments, post.id, post.isDemo]);

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || commentSubmitting || post.isDemo || feedSource !== "cloud") {
      return;
    }

    setCommentSubmitting(true);
    try {
      const comment = await postCommunityCommentCloud(post.id, text);
      setComments((prev) => [...prev, comment]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    } catch {
      alert(t("community.comment.postFailed", "留言失敗，請稍後再試"));
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (comment: CommunityComment) => {
    if (!currentUserEmail || comment.authorEmail !== currentUserEmail.trim().toLowerCase()) {
      return;
    }
    const ok = window.confirm(
      t("community.comment.deleteConfirm", "確定刪除呢則留言？")
    );
    if (!ok) return;

    try {
      await deleteCommunityCommentCloud(post.id, comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setCommentCount((c) => Math.max(0, c - 1));
    } catch {
      alert(t("community.comment.deleteFailed", "刪除留言失敗"));
    }
  };

  const toggleLike = async () => {
    if (post.isDemo || likeLoading) {
      if (post.isDemo) {
        setLiked((prev) => {
          const next = !prev;
          setLikeCount((c) => (next ? c + 1 : c - 1));
          return next;
        });
      }
      return;
    }

    setLikeLoading(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));

    try {
      if (feedSource === "cloud") {
        const result = await toggleCommunityLikeCloud(post.id);
        setLiked(result.liked);
        setLikeCount(result.likeCount);
      } else {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUserEmail) return;
    setMenuOpen(false);
    const ok = window.confirm(
      t("community.post.deleteConfirm", "確定要刪除呢篇貼文？")
    );
    if (!ok) return;

    try {
      if (feedSource === "cloud" && !post.isDemo) {
        await deleteCommunityPostCloud(post.id);
      } else if (deleteCommunityPost(post.id, currentUserEmail)) {
        onPostChanged?.();
        return;
      } else {
        return;
      }
      onPostChanged?.();
    } catch {
      alert(t("community.post.deleteFailed", "刪除失敗"));
    }
  };

  const handleStartEdit = () => {
    setMenuOpen(false);
    setEditText(post.bodyText ?? "");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!currentUserEmail) return;
    setSaving(true);
    try {
      if (feedSource === "cloud" && !post.isDemo) {
        await updateCommunityPostCloud(post.id, editText);
      } else {
        updateCommunityPost(post.id, currentUserEmail, { bodyText: editText });
      }
      setEditing(false);
      onPostChanged?.();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "EMPTY_POST") {
        alert(
          t(
            "community.post.emptyError",
            "文字同媒體不能同時為空"
          )
        );
      } else {
        alert(t("community.post.saveFailed", "儲存失敗"));
      }
    } finally {
      setSaving(false);
    }
  };

  const hasMacros =
    post.kind === "meal" &&
    post.calories != null &&
    post.protein != null &&
    post.carbs != null &&
    post.fats != null;

  const displayBody = editing ? null : post.bodyText;
  const [authorPhoto, setAuthorPhoto] = useState<string | null>(() =>
    post.authorAvatarUrl ?? getProfilePhotoUrl(post.authorEmail)
  );

  useEffect(() => {
    const snap = post.authorAvatarUrl ?? getProfilePhotoUrl(post.authorEmail);
    setAuthorPhoto(snap);
    if (snap || post.isDemo) return;
    let cancelled = false;
    void fetchPublicAvatarUrl(post.authorEmail).then((url) => {
      if (!cancelled) setAuthorPhoto(url ?? snap);
    });
    return () => {
      cancelled = true;
    };
  }, [post.authorAvatarUrl, post.authorEmail, post.isDemo]);

  return (
    <article className={SOFT_CARD}>
      <div className="flex items-start gap-3 p-4 pb-2 min-w-0 relative">
        <div
          className={`w-10 h-10 shrink-0 rounded-full ${authorPhoto ? "bg-gray-100" : post.avatarHue} text-white text-sm font-bold flex items-center justify-center overflow-hidden`}
          aria-hidden
        >
          {authorPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={authorPhoto}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            post.authorInitials
          )}
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <p className="font-semibold text-sm text-gray-900 truncate">
            {post.authorName}
            {post.isDemo && (
              <span className="ml-1.5 text-[9px] font-bold text-gray-400 uppercase">
                Demo
              </span>
            )}
          </p>
          <p className="text-[11px] text-gray-500">{post.postedAt}</p>
        </div>

        {isOwner && (
          <div className="absolute top-3 right-3" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={`p-1.5 rounded-full text-zinc-500 hover:bg-zinc-100 ${btnClass}`}
              aria-label={t("community.post.moreActions", "更多操作")}
              aria-expanded={menuOpen}
            >
              <MoreVertical size={20} strokeWidth={2} aria-hidden />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 min-w-[7.5rem] bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] py-1 z-20 overflow-hidden"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleStartEdit}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50 ${btnClass}`}
                >
                  <Pencil size={16} className="text-zinc-500 shrink-0" aria-hidden />
                  {t("community.post.edit", "編輯")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDelete}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 ${btnClass}`}
                >
                  <Trash2 size={16} className="shrink-0" aria-hidden />
                  {t("community.post.delete", "刪除")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="px-4 pb-3 space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            placeholder={t(
              "community.composer.placeholder",
              "分享你嘅想法、飲食心得…"
            )}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 ${btnClass}`}
            >
              {t("common.cancel", "取消")}
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={saving}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 disabled:opacity-50 ${btnClass}`}
            >
              {saving
                ? t("common.saving", "儲存中…")
                : t("common.save", "儲存")}
            </button>
          </div>
        </div>
      ) : (
        displayBody && (
          <p className="px-4 pb-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
            {displayBody}
          </p>
        )
      )}

      {post.mediaUrl && post.mediaType === "image" && (
        <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.mediaUrl}
            alt={post.mealName ?? t("community.feed.photoAlt", "貼文相片")}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      {post.mediaUrl && post.mediaType === "video" && (
        <div className="relative w-full bg-black overflow-hidden">
          <video
            src={post.mediaUrl}
            controls
            playsInline
            className="w-full max-h-80 object-contain"
          />
        </div>
      )}

      <div className="p-4 space-y-3 min-w-0">
        {post.mealName && (
          <div>
            <h3 className="font-semibold text-gray-900">{post.mealName}</h3>
            {hasMacros && (
              <p className="text-sm text-emerald-700 font-bold mt-0.5">
                {post.calories} kcal
              </p>
            )}
          </div>
        )}

        {hasMacros && (
          <div className="flex flex-wrap gap-1.5">
            <MacroTag label="P" value={post.protein!} unit="g" />
            <MacroTag label="C" value={post.carbs!} unit="g" />
            <MacroTag label="F" value={post.fats!} unit="g" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void toggleLike()}
            disabled={likeLoading}
            className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
              liked
                ? "bg-rose-50 text-rose-600"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            } ${btnClass}`}
            aria-pressed={liked}
          >
            <Heart
              size={18}
              strokeWidth={2}
              className={liked ? "fill-rose-500 text-rose-500" : ""}
              aria-hidden
            />
            {t("community.feed.like", "讚好")} · {likeCount}
          </button>

          <span className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold bg-gray-50 text-gray-600">
            <MessageCircle size={18} strokeWidth={2} aria-hidden />
            {t("community.feed.comment", "留言")} · {commentCount}
          </span>
        </div>

        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 space-y-3">
            {commentsLoading ? (
              <p className="text-xs text-gray-500">
                {t("community.comment.loading", "載入留言中…")}
              </p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-500">
                {t("community.comment.empty", "暫時未有留言，做第一個留言嘅人！")}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {comments.map((comment) => {
                  const isCommentOwner =
                    currentUserEmail != null &&
                    comment.authorEmail === currentUserEmail.trim().toLowerCase();
                  return (
                    <li key={comment.id} className="flex gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 shrink-0 rounded-full ${comment.avatarHue} text-white text-[10px] font-bold flex items-center justify-center`}
                        aria-hidden
                      >
                        {comment.authorInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {comment.authorName}
                          </p>
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {comment.postedAt}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                          {comment.bodyText}
                        </p>
                        {isCommentOwner && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteComment(comment)}
                            className={`mt-1 text-[10px] text-rose-600 font-medium ${btnClass}`}
                          >
                            {t("community.comment.delete", "刪除")}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!post.isDemo && feedSource === "cloud" && currentUserEmail && (
              <div className="flex gap-2 items-end">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={t(
                    "community.comment.placeholder",
                    "寫低你嘅留言…"
                  )}
                  className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <button
                  type="button"
                  disabled={commentSubmitting || !commentText.trim()}
                  onClick={() => void submitComment()}
                  className={`shrink-0 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-sky-600 disabled:opacity-50 ${btnClass}`}
                >
                  {commentSubmitting
                    ? t("common.sending", "送出中…")
                    : t("community.comment.send", "送出")}
                </button>
              </div>
            )}
          </div>
      </div>
    </article>
  );
}
