"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, MoreVertical, Pencil, Trash2 } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import {
  deleteCommunityPost,
  isCommunityPostOwner,
  updateCommunityPost,
  type CommunityFeedPost,
} from "@/lib/community";

const SOFT_CARD =
  "w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden min-w-0";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  post: CommunityFeedPost;
  currentUserEmail?: string;
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
  onPostChanged,
}: Props) {
  const { t } = useI18n();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
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

  const toggleLike = () => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : c - 1));
      return next;
    });
  };

  const handleDelete = () => {
    if (!currentUserEmail) return;
    setMenuOpen(false);
    const ok = window.confirm(
      t("community.post.deleteConfirm", "確定要刪除呢篇貼文？")
    );
    if (!ok) return;
    if (deleteCommunityPost(post.id, currentUserEmail)) {
      onPostChanged?.();
    }
  };

  const handleStartEdit = () => {
    setMenuOpen(false);
    setEditText(post.bodyText ?? "");
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!currentUserEmail) return;
    setSaving(true);
    try {
      updateCommunityPost(post.id, currentUserEmail, { bodyText: editText });
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

  return (
    <article className={SOFT_CARD}>
      <div className="flex items-start gap-3 p-4 pb-2 min-w-0 relative">
        <div
          className={`w-10 h-10 shrink-0 rounded-full ${post.avatarHue} text-white text-sm font-bold flex items-center justify-center`}
          aria-hidden
        >
          {post.authorInitials}
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

        <button
          type="button"
          onClick={toggleLike}
          className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${
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
      </div>
    </article>
  );
}
