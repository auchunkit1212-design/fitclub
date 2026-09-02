"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ComingSoonFeature } from "@/components/ComingSoonFeature";
import { LoadingView } from "@/components/LoadingView";
import { useI18n } from "@/components/I18nProvider";
import { getSession } from "@/lib/session";
import type { UserSession } from "@/lib/types";

export default function GroceryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace("/register");
      return;
    }
    setSession(current);
  }, [router]);

  if (!session) {
    return <LoadingView message={t("common.loading", "載入中…")} />;
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
