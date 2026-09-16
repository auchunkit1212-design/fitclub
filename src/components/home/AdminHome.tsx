"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HOME_BTN_CLASS,
  HOME_SOFT_CARD,
  HomeShell,
} from "@/components/home/HomeShell";
import { useI18n } from "@/components/I18nProvider";
import { brandingFromSession } from "@/lib/home-session";
import { goTo } from "@/lib/navigate";
import { syncSessionPlan } from "@/lib/plan-client";
import { fetchUsersForSession } from "@/lib/registry";
import { clearSession, saveSession } from "@/lib/session";
import { withTimeout } from "@/lib/with-timeout";
import type { RegistryUser, UserSession } from "@/lib/types";

const FranchiseConsole = dynamic(
  () =>
    import("@/components/FranchiseConsole").then((m) => ({
      default: m.FranchiseConsole,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 rounded-3xl bg-zinc-100 animate-pulse" />
    ),
  }
);

export function AdminHome({
  initialSession,
}: {
  initialSession: UserSession;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState(initialSession);
  const [registry, setRegistry] = useState<RegistryUser[]>([]);
  const [toast, setToast] = useState("");
  const [registryReady, setRegistryReady] = useState(false);
  const branding = brandingFromSession(session);
  const title = branding.appTitle;
  const displayName = session.name;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    router.prefetch("/coach/students");
    router.prefetch("/coach");
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [synced, users] = await Promise.all([
          syncSessionPlan().catch(() => initialSession),
          withTimeout(
            fetchUsersForSession(initialSession),
            12_000,
            t("errors.fetchUsersTimeout", "讀取用戶逾時")
          ),
        ]);
        if (cancelled) return;
        if (synced) {
          setSession(synced);
          saveSession(synced);
        }
        setRegistry(users);
      } catch {
        if (!cancelled) {
          showToast(
            t("home.errors.cloudLoadFailed", "暫時讀唔到資料，請檢查網絡後再試。")
          );
        }
      } finally {
        if (!cancelled) setRegistryReady(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialSession, t]);

  return (
    <HomeShell
      session={session}
      brandingLogo={branding.logo}
      title={title}
      displayName={displayName}
      homeLabel={t("home.adminHome", "老闆主頁")}
      toast={toast}
      onLogout={() => {
        clearSession();
        goTo(router, "/register");
      }}
    >
      <button
        type="button"
        onClick={() => router.push("/coach/students")}
        className={`w-full ${HOME_SOFT_CARD} px-4 py-4 text-left ring-1 ring-emerald-600/30 ${HOME_BTN_CLASS}`}
      >
        <p className="font-semibold text-emerald-800">
          {t("home.coachStudentsCta", "學員管理同飲食紀錄")}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {t(
            "home.coachStudentsHint",
            "登記學員、查看名單同打卡分析 — 亦可撳底部「學員」分欄"
          )}
        </p>
      </button>

      {registryReady ? (
        <FranchiseConsole
          session={session}
          registry={registry}
          onRegistryChange={setRegistry}
          onToast={showToast}
          onGoCoach={() => router.push("/coach")}
        />
      ) : (
        <div className="h-40 rounded-3xl bg-zinc-100 animate-pulse" />
      )}
    </HomeShell>
  );
}
