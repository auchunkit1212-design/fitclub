"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachFeatureGrid } from "@/components/CoachFeatureGrid";
import { HomeShell } from "@/components/home/HomeShell";
import { useI18n } from "@/components/I18nProvider";
import { prefetchCoachInbox } from "@/lib/coach-inbox-client";
import { brandingFromSession } from "@/lib/home-session";
import { goTo } from "@/lib/navigate";
import { syncSessionPlan } from "@/lib/plan-client";
import { applyBrandToSession } from "@/lib/branding";
import { clearSession, saveSession } from "@/lib/session";
import type { UserSession } from "@/lib/types";

export function CoachHome({
  initialSession,
}: {
  initialSession: UserSession;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState(initialSession);
  const branding = brandingFromSession(session);
  const title = branding.appTitle;
  const displayName = session.name;

  useEffect(() => {
    router.prefetch("/coach");
    router.prefetch("/coach/students");
    router.prefetch("/leaderboard");
    void prefetchCoachInbox();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void syncSessionPlan()
      .then((synced) => {
        if (cancelled || !synced) return;
        const next = applyBrandToSession(synced, {
          gymName: synced.brandName ?? synced.gym,
          broadcast: "",
          branding: brandingFromSession(synced),
          tenantSlug: synced.tenantSlug,
        });
        setSession(next);
        saveSession(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HomeShell
      session={session}
      brandingLogo={branding.logo}
      title={title === session.gym ? "" : title}
      displayName={displayName}
      homeLabel={t("home.coachHome", "教練主頁")}
      showWelcome={false}
      onRefresh={async () => {
        const synced = await syncSessionPlan().catch(() => null);
        if (!synced) return;
        setSession(synced);
        saveSession(synced);
      }}
      onLogout={() => {
        clearSession();
        goTo(router, "/register");
      }}
    >
      <CoachFeatureGrid />
    </HomeShell>
  );
}
