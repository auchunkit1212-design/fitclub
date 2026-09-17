"use client";

import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/components/I18nProvider";
import type { UserSession } from "@/lib/types";

type ComingSoonFeatureProps = {
  session: UserSession;
  title: string;
  body: string;
};

export function ComingSoonFeature({
  session,
  title,
  body,
}: ComingSoonFeatureProps) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-zinc-50 pb-32 max-w-lg mx-auto">
      <PageHeader
        title={title}
        onBack={() => router.push("/community")}
        backLabel={t("leaderboard.back", "← 探索")}
      />
      <main className="px-4 py-6">
        <section className="rounded-3xl bg-white border border-zinc-100 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700 bg-amber-100 inline-flex px-2 py-0.5 rounded-full">
            {t("community.hub.comingSoonBadge", "即將開放")}
          </p>
          <p className="text-sm text-zinc-700 mt-3 leading-relaxed">{body}</p>
        </section>
      </main>
      <BottomNav
        role={session.role === "admin" ? "admin" : session.role}
      />
    </div>
  );
}
