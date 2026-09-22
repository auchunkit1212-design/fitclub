"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachPushSubscribe } from "@/components/CoachPushSubscribe";
import { CoachInviteCodePanel } from "@/components/CoachInviteCodePanel";
import { CoachSelfMealPanel } from "@/components/CoachSelfMealPanel";
import { useBranding } from "@/components/BrandingProvider";
import {
  defaultMealLogsFromDate,
  fetchOwnMealLogsForSession,
  fetchUsersForSession,
  updateCoachLogo,
} from "@/lib/db";
import { applyBrandToSession, resolveBrandForUser } from "@/lib/branding";
import { saveSession, getSessionRequestHeaders } from "@/lib/session";
import { compressFileImage } from "@/lib/image";
import { PageHeader } from "@/components/PageHeader";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { PageSkeleton } from "@/components/PageSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";
import { COACH_ROLES, useRequiredSession } from "@/components/SessionProvider";
import { withTimeout } from "@/lib/with-timeout";

const CoachAiReportPanel = dynamic(
  () =>
    import("@/components/CoachAiReportPanel").then((m) => ({
      default: m.CoachAiReportPanel,
    })),
  { ssr: false, loading: () => <PageSkeleton rows={2} /> }
);

const ProBillingPanel = dynamic(
  () =>
    import("@/components/ProBillingPanel").then((m) => ({
      default: m.ProBillingPanel,
    })),
  { ssr: false }
);
import type {
  MealLog,
  RegistryUser,
  ThemeColor,
} from "@/lib/types";
import { DEFAULT_BRANDING } from "@/lib/types";
import { GorillaMascot } from "@/components/GorillaMascot";
import { SOFT_CARD } from "@/lib/ui-tokens";

type CoachTab = "invite" | "brand" | "more";

const TAB_FROM_HASH: Record<string, CoachTab> = {
  "coach-invite": "invite",
  "coach-branding": "brand",
  "coach-notifications": "more",
  "coach-meals": "more",
  "coach-plan": "more",
  "coach-report": "more",
};

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const THEME_OPTIONS: { value: ThemeColor; label: string }[] = [
  { value: "emerald", label: "翠綠 (Emerald)" },
  { value: "blue", label: "藍色 (Blue)" },
  { value: "black", label: "黑色 (Black)" },
];

const LOAD_TIMEOUT_MS = 12_000;

export default function CoachPage() {
  const router = useRouter();
  const brand = useBranding();
  const { session } = useRequiredSession(COACH_ROLES);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [appTitle, setAppTitle] = useState("");
  const [themeColor, setThemeColor] = useState<ThemeColor>("emerald");
  const [logo, setLogo] = useState<string | undefined>();
  const [broadcast, setBroadcast] = useState("");
  const [registry, setRegistry] = useState<RegistryUser[]>([]);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [ownMealLogs, setOwnMealLogs] = useState<MealLog[]>([]);
  const [toast, setToast] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<CoachTab>("invite");
  const silentRefreshRef = useRef(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    if (!session) return;
    setAppTitle((prev) => prev || session.brandName || session.gym || "");
    setInviteCode(
      (prev) => prev || session.tenantSlug || session.tenantId || ""
    );
    setLogo((prev) => prev || session.brandLogo);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const load = async () => {
      if (!silentRefreshRef.current) {
        setCloudLoading(true);
      }

      try {
        const [userRegistry, ownLogs] = await withTimeout(
          Promise.all([
            fetchUsersForSession(session),
            fetchOwnMealLogsForSession(session, {
              from: defaultMealLogsFromDate(14),
            }),
          ]),
          LOAD_TIMEOUT_MS,
          "讀取教練資料逾時"
        );
        if (cancelled) return;
        setRegistry(userRegistry);
        setOwnMealLogs(ownLogs);

        if (session.role === "coach") {
          const resolved = await resolveBrandForUser(session, userRegistry);
          if (cancelled) return;
          setInviteCode(
            resolved.tenantSlug ??
              session.tenantSlug ??
              session.tenantId ??
              ""
          );
          setAppTitle(resolved.branding.appTitle);
          setThemeColor(resolved.branding.themeColor);
          setLogo(resolved.branding.logo);
          setBroadcast(resolved.broadcast);
        } else {
          setAppTitle(DEFAULT_BRANDING.appTitle);
          setThemeColor(DEFAULT_BRANDING.themeColor);
        }
      } catch {
        if (!cancelled) {
          alert("暫時載唔到教練資料，請稍後再試。");
        }
      } finally {
        if (!cancelled) {
          silentRefreshRef.current = false;
          setCloudLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey]);

  useEffect(() => {
    if (!session) return;
    const hash = window.location.hash.slice(1);
    if (hash && TAB_FROM_HASH[hash]) {
      setTab(TAB_FROM_HASH[hash]);
    }
    if (!hash) return;
    const target = document.getElementById(hash);
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [session, cloudLoading]);

  const handlePublish = async () => {
    if (!session || session.role !== "coach") {
      alert("請用教練帳號登入後再發布品牌設定。");
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/coach/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          appTitle: appTitle.trim() || DEFAULT_BRANDING.appTitle,
          themeColor,
          logo,
          broadcast: broadcast.trim(),
          tenantId: session.tenantId,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        tenantId?: string;
        tenantSlug?: string;
      };
      if (!res.ok) {
        console.error("[coach] branding publish failed:", data);
        alert(
          data.hint
            ? `${data.error ?? "儲存失敗"}\n\n${data.hint}`
            : data.error ?? "儲存失敗，請稍後再試。"
        );
        return;
      }
      const slug = data.tenantSlug?.trim() ?? "";
      if (slug) setInviteCode(slug);
      const updated = applyBrandToSession(session, {
        gymName: appTitle.trim(),
        branding: { appTitle: appTitle.trim(), themeColor, logo },
        broadcast: broadcast.trim(),
        tenantSlug: slug || session.tenantSlug,
      });
      saveSession({
        ...updated,
        tenantId: data.tenantId ?? updated.tenantId ?? session.tenantId,
        tenantSlug: slug || updated.tenantSlug,
      });
      alert(
        slug
          ? `品牌已儲存！你的學員邀請碼：${slug}`
          : "品牌設定已儲存！"
      );
    } catch (err) {
      console.error("[coach] branding publish error:", err);
      alert("儲存失敗，請稍後再試。");
    } finally {
      setPublishing(false);
    }
  };

  const handleLogoPick = () => logoInputRef.current?.click();

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session || session.role !== "coach") return;

    try {
      const compressed = await compressFileImage(file);
      setLogo(compressed);
      await updateCoachLogo(session.email, compressed, session.tenantId);
      alert("Logo 已上載成功！");
    } catch {
      alert("Logo 處理或上傳失敗。");
    }
    e.target.value = "";
  };

  if (!session) {
    return <AppLoadingScreen />;
  }

  return (
    <PullToRefresh
      onRefresh={() => {
        silentRefreshRef.current = true;
        setRefreshKey((key) => key + 1);
      }}
    >
    <div className="min-h-screen bg-white pb-32 max-w-lg mx-auto">
      <PageHeader
        title="教練後台"
        subtitle={appTitle.trim() || brand.gymName}
        variant="light"
        backLabel="← 返回"
        onBack={() => router.push("/")}
      />

      <main className="px-4 py-5 space-y-5">
        <section className={`${SOFT_CARD} p-5 flex items-center gap-4`}>
          <GorillaMascot
            size="md"
            logoUrl={logo || brand.logo || session.brandLogo}
          />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">健身室</p>
            <p className="text-lg font-semibold text-gray-900 truncate">
              {appTitle.trim() || brand.gymName}
            </p>
            {inviteCode ? (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                邀請碼 {inviteCode}
              </p>
            ) : null}
          </div>
        </section>

        {session.role === "coach" ? (
        <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 rounded-2xl">
          {(
            [
              ["invite", "邀請"],
              ["brand", "品牌"],
              ["more", "更多"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`py-2.5 rounded-xl text-sm font-semibold ${btnClass} ${
                tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        ) : null}

        {tab === "invite" && session.role === "coach" ? (
          <div id="coach-invite" className="scroll-mt-24">
            <CoachInviteCodePanel
              inviteCode={inviteCode}
              brandName={appTitle.trim() || brand.gymName}
              loading={cloudLoading}
              onCopied={showToast}
            />
          </div>
        ) : null}

        {tab === "brand" && session.role === "coach" ? (
          <section
            id="coach-branding"
            className={`scroll-mt-24 ${SOFT_CARD} p-5 space-y-5`}
          >
            <div>
              <h2 className="font-semibold text-gray-900">品牌設定</h2>
              <p className="text-xs text-gray-500 mt-1">
                學員開 App 同載入畫面都會見到呢個標誌。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                健身室 Logo
              </label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <button
                type="button"
                onClick={handleLogoPick}
                className={`flex w-full items-center gap-4 rounded-2xl bg-zinc-50 px-4 py-3 text-left ${btnClass}`}
              >
                <GorillaMascot size="md" logoUrl={logo} />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {logo ? "更換 Logo" : "上傳 Logo"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    方形圖片最清楚
                  </p>
                </div>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                健身室名稱
              </label>
              <input
                type="text"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                className="w-full rounded-2xl bg-zinc-50 px-4 py-3 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                主題色
              </label>
              <div className="flex gap-3">
                {THEME_OPTIONS.map((option) => {
                  const selected = themeColor === option.value;
                  const swatch =
                    option.value === "blue"
                      ? "bg-blue-600"
                      : option.value === "black"
                        ? "bg-zinc-900"
                        : "bg-emerald-600";
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setThemeColor(option.value)}
                      className={`flex-1 rounded-2xl px-3 py-3 text-xs font-medium ${btnClass} ${
                        selected
                          ? "bg-white ring-2 ring-emerald-600 text-gray-900"
                          : "bg-zinc-50 text-gray-500"
                      }`}
                    >
                      <span
                        className={`mx-auto mb-2 block h-6 w-6 rounded-full ${swatch}`}
                      />
                      {option.label.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                學員廣播
              </label>
              <textarea
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                rows={3}
                placeholder="可選：通知全部學員"
                className="w-full rounded-2xl bg-zinc-50 px-4 py-3 resize-none text-gray-900"
              />
            </div>

            <button
              type="button"
              disabled={publishing}
              onClick={handlePublish}
              className={`w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl disabled:opacity-60 ${btnClass}`}
            >
              {publishing ? "儲存緊..." : "儲存"}
            </button>
          </section>
        ) : null}

        {tab === "more" || session.role !== "coach" ? (
          <div className="space-y-4">
            {(session.role === "coach" || session.role === "admin") && (
              <div id="coach-notifications" className="scroll-mt-24">
                <CoachPushSubscribe />
              </div>
            )}

            {(session.role === "coach" || session.role === "admin") && (
              <div id="coach-meals" className="scroll-mt-24">
                <CoachSelfMealPanel logs={ownMealLogs} />
              </div>
            )}

            {(session.role === "coach" || session.role === "admin") && (
              <div id="coach-plan" className="scroll-mt-24">
                <ProBillingPanel />
              </div>
            )}

            <div id="coach-report" className="scroll-mt-24">
              <CoachAiReportPanel
                session={session}
                registry={registry}
                gymName={appTitle.trim() || brand.gymName}
                onToast={showToast}
                variant="light"
              />
            </div>
          </div>
        ) : null}

        <LegalFooterLinks className="py-2" />
      </main>

      <BottomNav role={session?.role === "admin" ? "admin" : "coach"} />

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto bg-white border border-gray-200 text-gray-900 text-sm text-center py-3 rounded-xl z-50 shadow-md">
          {toast}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
