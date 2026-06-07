"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { CommunityComposer } from "@/components/CommunityComposer";
import { CommunityFeedCard } from "@/components/CommunityFeedCard";
import { Globe, IconLabel, Loader2 } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { fetchCommunityFeedCloud } from "@/lib/community-client";
import type { CommunityFeedPost } from "@/lib/community";
import { getSession } from "@/lib/session";
import type { UserSession } from "@/lib/types";

export default function CommunityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<UserSession | null>(null);
  const [posts, setPosts] = useState<CommunityFeedPost[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedSource, setFeedSource] = useState<"cloud" | "local">("cloud");
  const [loadError, setLoadError] = useState("");

  const refreshFeed = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await fetchCommunityFeedCloud();
      setPosts(result.posts);
      setFeedSource(result.source);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : t("community.feed.loadFailed", "載入失敗")
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace("/register");
      return;
    }
    setSession(current);
    void refreshFeed().finally(() => setReady(true));
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
        {feedSource === "cloud" ? (
          <p className="text-[11px] text-emerald-600 mt-2 font-medium">
            {t("community.cloudSynced", "已連接雲端社群 — 同分店學員可見")}
          </p>
        ) : (
          <p className="text-[11px] text-amber-700 mt-2">
            {t(
              "community.localFallback",
              "雲端未就緒，暫用本機示範模式（請執行 community-posts.sql）"
            )}
          </p>
        )}
      </header>

      <main className="px-4 py-5 space-y-6 min-w-0">
        <CommunityComposer session={session} onPosted={() => void refreshFeed()} />

        <section className="space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              {t("community.feed.title", "大家都在吃什麼")}
            </h2>
            <button
              type="button"
              onClick={() => void refreshFeed()}
              disabled={loading}
              className="text-xs font-semibold text-emerald-600 disabled:opacity-50"
            >
              {loading
                ? t("common.loading", "載入中…")
                : t("community.feed.refresh", "重新整理")}
            </button>
          </div>

          {loadError ? (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
              {loadError}
            </p>
          ) : null}

          {loading && posts.length === 0 ? (
            <div className="flex justify-center py-12 text-zinc-400">
              <Loader2 size={28} className="animate-spin" aria-hidden />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
              <p className="text-sm font-medium text-gray-700">
                {t("community.feed.emptyTitle", "仲未有貼文")}
              </p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {t(
                  "community.feed.emptyHint",
                  "成為第一個分享飲食心得嘅人！或者記錄飲食時勾選「分享到 Community」。"
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <CommunityFeedCard
                  key={post.id}
                  post={post}
                  currentUserEmail={session.email}
                  feedSource={feedSource}
                  onPostChanged={() => void refreshFeed()}
                />
              ))}
            </div>
          )}

          {feedSource === "local" ? (
            <p className="text-center text-[11px] text-gray-400 pt-2 leading-relaxed">
              {t(
                "community.feed.hint",
                "示範帖文僅在離線模式顯示；設定 Supabase 後會同步到雲端。"
              )}
            </p>
          ) : null}
        </section>
      </main>

      <BottomNav
        role={session.role ?? "student"}
        onFabClick={
          session.role === "student"
            ? () => router.push("/add-meal")
            : () => router.push("/coach/students")
        }
      />
    </div>
  );
}
