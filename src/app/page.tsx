"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HomeChunkFallback } from "@/components/home/HomeShell";
import { useI18n } from "@/components/I18nProvider";
import { normalizeHomeSession } from "@/lib/home-session";
import { goTo } from "@/lib/navigate";
import { getSession } from "@/lib/session";
import type { UserSession } from "@/lib/types";

const StudentHome = dynamic(
  () =>
    import("@/components/home/StudentHome").then((m) => ({
      default: m.StudentHome,
    })),
  { ssr: false, loading: () => <HomeChunkFallback /> }
);

const CoachHome = dynamic(
  () =>
    import("@/components/home/CoachHome").then((m) => ({
      default: m.CoachHome,
    })),
  { ssr: false, loading: () => <HomeChunkFallback /> }
);

const AdminHome = dynamic(
  () =>
    import("@/components/home/AdminHome").then((m) => ({
      default: m.AdminHome,
    })),
  { ssr: false, loading: () => <HomeChunkFallback /> }
);

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<UserSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const parsed = getSession();
    if (!parsed) {
      setChecked(true);
      goTo(router, "/register");
      return;
    }

    setSession(
      normalizeHomeSession(parsed, {
        trialStudent: t("home.defaults.trialStudent", "體驗學員"),
        unboundGym: t("home.defaults.unboundGym", "未綁定分店"),
      })
    );
    setChecked(true);
  }, [router, t]);

  if (!checked) {
    return <HomeChunkFallback />;
  }

  if (!session) {
    return <HomeChunkFallback />;
  }

  if (session.role === "admin") {
    return <AdminHome initialSession={session} />;
  }

  if (session.role === "coach") {
    return <CoachHome initialSession={session} />;
  }

  return <StudentHome initialSession={session} />;
}
