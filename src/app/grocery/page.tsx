"use client";

import { ComingSoonFeature } from "@/components/ComingSoonFeature";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useI18n } from "@/components/I18nProvider";
import { useRequiredSession } from "@/components/SessionProvider";

export default function GroceryPage() {
  const { t } = useI18n();
  const { session } = useRequiredSession();

  if (!session) {
    return (
      <div className="min-h-screen bg-white pb-32 max-w-lg mx-auto px-4 py-6">
        <PageSkeleton rows={3} />
      </div>
    );
  }

  return (
    <ComingSoonFeature
      session={session}
      title={t("community.hub.smart-grocery.title", "智能買餸清單")}
      body={t(
        "community.hub.comingSoonPage",
        "呢個功能即將推出。教練同學員而家都可以由探索入嚟睇預告，正式版會按營養目標自動建議買餸。"
      )}
    />
  );
}
