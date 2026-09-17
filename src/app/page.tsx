"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeChunkFallback } from "@/components/home/HomeShell";
import { useI18n } from "@/components/I18nProvider";
import { useAppSession } from "@/components/SessionProvider";
import { normalizeHomeSession } from "@/lib/home-session";
import { goTo } from "@/lib/navigate";

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
  const { session, checked } = useAppSession();

  useEffect(() => {
    if (!checked) return;
    if (!session) goTo(router, "/register");
  }, [checked, router, session]);

  if (!checked || !session) {
    return <HomeChunkFallback />;
  }

  const normalized = normalizeHomeSession(session, {
    trialStudent: t("home.defaults.trialStudent", "體驗學員"),
    unboundGym: t("home.defaults.unboundGym", "未綁定分店"),
  });

  if (normalized.role === "admin") {
    return <AdminHome initialSession={normalized} />;
  }

  if (normalized.role === "coach") {
    return <CoachHome initialSession={normalized} />;
  }

  return <StudentHome initialSession={normalized} />;
}
