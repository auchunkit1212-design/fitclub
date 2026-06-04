"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { CommunityFeedCard } from "@/components/CommunityFeedCard";
import { CommunityHubStrip } from "@/components/CommunityHubStrip";
import { Globe, IconLabel } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { COMMUNITY_FEED_MOCK } from "@/lib/community-mock";
import { getSession } from "@/lib/session";
import type { UserSession } from "@/lib/types";

export default function CommunityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace("/register");
      return;
    }
    setSession(current);
    setReady(true);
  }, [router]);

  if (!ready) {
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
            "發掘新功能，同其他學員分享你今日食咗咩。"
          )}
        </p>
      </header>

      <main className="px-4 py-5 space-y-8 min-w-0">
        <CommunityHubStrip />

        <section className="space-y-4 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {t("community.feed.title", "大家都在吃什麼")}
          </h2>
          <div className="space-y-4">
            {COMMUNITY_FEED_MOCK.map((post) => (
              <CommunityFeedCard key={post.id} post={post} />
            ))}
          </div>
          <p className="text-center text-[11px] text-gray-400 pt-2">
            {t("community.feed.mockHint", "以上為示範動態，正式版將連接真實社群")}
          </p>
        </section>
      </main>

      <BottomNav
        activeTab="dashboard"
        role={session?.role ?? "student"}
        onTabChange={(tab) => {
          router.push(tab === "settings" ? "/?tab=settings" : "/");
        }}
        onFabClick={
          session?.role === "student"
            ? () => router.push("/add-meal")
            : () => router.push("/coach/records")
        }
      />
    </div>
  );
}
