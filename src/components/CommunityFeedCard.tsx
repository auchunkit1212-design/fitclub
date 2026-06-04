"use client";

import { useState } from "react";
import { Heart } from "@/components/icons";
import type { CommunityFeedPost } from "@/lib/community-mock";
import { useI18n } from "@/components/I18nProvider";

const SOFT_CARD =
  "w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden min-w-0";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  post: CommunityFeedPost;
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

export function CommunityFeedCard({ post }: Props) {
  const { t } = useI18n();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);

  const toggleLike = () => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : c - 1));
      return next;
    });
  };

  return (
    <article className={`${SOFT_CARD}`}>
      <div className="flex items-center gap-3 p-4 pb-3 min-w-0">
        <div
          className={`w-10 h-10 shrink-0 rounded-full ${post.avatarHue} text-white text-sm font-bold flex items-center justify-center`}
          aria-hidden
        >
          {post.authorInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-gray-900 truncate">
            {post.authorName}
          </p>
          <p className="text-[11px] text-gray-500">{post.postedAt}</p>
        </div>
      </div>

      <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.imageUrl}
          alt={post.mealName}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="p-4 space-y-3 min-w-0">
        <div>
          <h3 className="font-semibold text-gray-900">{post.mealName}</h3>
          <p className="text-sm text-emerald-700 font-bold mt-0.5">
            {post.calories} kcal
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <MacroTag label="P" value={post.protein} unit="g" />
          <MacroTag label="C" value={post.carbs} unit="g" />
          <MacroTag label="F" value={post.fats} unit="g" />
        </div>

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
