"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { CommunityComposer } from "@/components/CommunityComposer";
import { CommunityFeedCard } from "@/components/CommunityFeedCard";
import { Globe, IconLabel } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { loadCommunityFeed, type CommunityFeedPost } from "@/lib/community";
import { getSession } from "@/lib/session";
import type { UserSession } from "@/lib/types";

export default function CommunityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<UserSession | null>(null);
  const [posts, setPosts] = useState<CommunityFeedPost[]>([]);
  const [ready, setReady] = useState(false);

  const refreshFeed = useCallback(() => {
    setPosts(loadCommunityFeed());
  }, []);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace("/register");
      return;
    }
    setSession(current);
    refreshFeed();
    setReady(true);
  }, [router, refreshFeed]);

  if (!ready || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
        {t("common.loading", "載入中…")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 overflow-x-hidden max-w-lg mx-auto w-full">
      <header className="pt-safe px-4 pb-4 border-b border-gray-100 bg-gradient-to-b from-[#ecfdf5] to-white">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">
          {t("community.badge", "Community")}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          <IconLabel icon={Globe} iconClassName="text-emerald-600" gapClass="gap-2">
            {t("community.title", "探索")}
          </IconLabel>
        </h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          {t(
            "community.subtitle",
            "分享想法、相片同影片，或者將飲食記錄同步到社群。"
          )}
        </p>
      </header>

      <main className="px-4 py-5 space-y-6 min-w-0">
        <CommunityComposer session={session} onPosted={refreshFeed} />

        <section className="space-y-4 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {t("community.feed.title", "大家都在吃什麼")}
          </h2>
          <div className="space-y-4">
            {posts.map((post) => (
              <CommunityFeedCard
                key={post.id}
                post={post}
                currentUserEmail={session.email}
                onPostChanged={refreshFeed}
              />
            ))}
          </div>
          <p className="text-center text-[11px] text-gray-400 pt-2 leading-relaxed">
            {t(
              "community.feed.hint",
              "你嘅分享會顯示喺呢度；示範帖文標有 Demo。"
            )}
          </p>
        </section>
      </main>

      <BottomNav role={session.role ?? "student"} />
    </div>
  );
}
