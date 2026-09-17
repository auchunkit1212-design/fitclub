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
  CoachBranding,
  MealLog,
  RegistryUser,
  ThemeColor,
  UserSession,
} from "@/lib/types";
import { DEFAULT_BRANDING } from "@/lib/types";

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
    if (!session || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
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
    return (
      <div className="min-h-screen bg-white pb-32 max-w-lg mx-auto">
        <PageHeader
          title="教練後台"
          subtitle={brand.gymName}
          variant="light"
          backLabel="← 返回主頁"
          onBack={() => router.push("/")}
        />
        <main className="px-4 py-4">
          <PageSkeleton rows={5} />
        </main>
      </div>
    );
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
        title={`${appTitle.trim() || brand.gymName} · 教練後台`}
        subtitle={`${appTitle.trim() || brand.appTitle || brand.gymName} · 品牌設定`}
        variant="light"
        backLabel="← 返回主頁"
        onBack={() => router.push("/")}
      />

      <main className="px-4 py-4 space-y-4">
        {session?.role === "coach" && (
          <div id="coach-invite" className="scroll-mt-24">
            <CoachInviteCodePanel
              inviteCode={inviteCode}
              brandName={appTitle.trim() || brand.gymName}
              loading={cloudLoading}
              onCopied={showToast}
            />
          </div>
        )}

        {(session?.role === "coach" || session?.role === "admin") && (
          <div id="coach-notifications" className="scroll-mt-24">
            <CoachPushSubscribe />
          </div>
        )}

        {(session?.role === "coach" || session?.role === "admin") && (
          <div id="coach-meals" className="scroll-mt-24">
            <CoachSelfMealPanel logs={ownMealLogs} />
          </div>
        )}

        {(session?.role === "coach" || session?.role === "admin") && (
          <div id="coach-plan" className="scroll-mt-24">
            <ProBillingPanel />
          </div>
        )}

        {session && (
          <div id="coach-report" className="scroll-mt-24">
            <CoachAiReportPanel
              session={session}
              registry={registry}
              gymName={appTitle.trim() || brand.gymName}
              onToast={showToast}
              variant="light"
            />
          </div>
        )}

        {session?.role === "coach" && (
          <section
            id="coach-branding"
            className="scroll-mt-24 bg-white rounded-2xl border border-zinc-100 p-4 space-y-4 shadow-sm"
          >
            <h2 className="font-semibold text-emerald-800">品牌設定</h2>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                App 標題
              </label>
              <input
                type="text"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                健身房 Logo
              </label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={handleLogoPick}
                onKeyDown={(e) => e.key === "Enter" && handleLogoPick()}
                className={`flex items-center gap-3 border-2 border-dashed border-zinc-300 rounded-xl p-3 ${btnClass}`}
              >
                <div className="w-12 h-12 rounded-full bg-zinc-100 overflow-hidden shrink-0">
                  {logo ? (
                    <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-zinc-400 flex items-center justify-center h-full">
                      無
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-600">撳一下上傳 Logo</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                主題色
              </label>
              <select
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value as ThemeColor)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-3"
              >
                {THEME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                緊急廣播訊息
              </label>
              <textarea
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-zinc-200 px-3 py-3 resize-none"
              />
            </div>

            <button
              type="button"
              disabled={publishing}
              onClick={handlePublish}
              className={`w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 ${btnClass}`}
            >
              {publishing ? "儲存緊..." : "儲存品牌設定"}
            </button>
          </section>
        )}

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
