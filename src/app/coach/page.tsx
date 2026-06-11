"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachAiReportPanel } from "@/components/CoachAiReportPanel";
import { CoachPushSubscribe } from "@/components/CoachPushSubscribe";
import { CoachInviteCodePanel } from "@/components/CoachInviteCodePanel";
import { CoachSelfMealPanel } from "@/components/CoachSelfMealPanel";
import { useBranding } from "@/components/BrandingProvider";
import {
  fetchOwnMealLogsForSession,
  fetchUsersForSession,
  resolveBranding,
  updateCoachLogo,
} from "@/lib/db";
import { applyBrandToSession, resolveBrandForUser } from "@/lib/branding";
import { saveSession, getSessionRequestHeaders } from "@/lib/session";
import { compressFileImage } from "@/lib/image";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";
import { ProBillingPanel } from "@/components/ProBillingPanel";
import { IconLabel } from "@/components/icons";
import { getSession } from "@/lib/session";
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

export default function CoachPage() {
  const router = useRouter();
  const brand = useBranding();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [appTitle, setAppTitle] = useState("");
  const [themeColor, setThemeColor] = useState<ThemeColor>("emerald");
  const [logo, setLogo] = useState<string | undefined>();
  const [broadcast, setBroadcast] = useState("");
  const [registry, setRegistry] = useState<RegistryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [ownMealLogs, setOwnMealLogs] = useState<MealLog[]>([]);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    const load = async () => {
      const current = getSession();
      if (!current || (current.role !== "coach" && current.role !== "admin")) {
        setLoading(false);
        router.push("/register");
        return;
      }

      setSession(current);

      try {
        const userRegistry = await fetchUsersForSession(current);
        setRegistry(userRegistry);

        if (current.role === "coach") {
          const brandResolved = await resolveBrandForUser(current, userRegistry);
          const resolved = await resolveBranding(current, userRegistry);
          setInviteCode(
            brandResolved.tenantSlug ??
              current.tenantSlug ??
              current.tenantId ??
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

        const ownLogs = await fetchOwnMealLogsForSession(current);
        setOwnMealLogs(ownLogs);
      } catch {
        alert("無法從 Supabase 載入教練數據。");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

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
            ? `${data.error ?? "雲端發布失敗"}\n\n${data.hint}`
            : data.error ?? "雲端發布失敗，請稍後再試。"
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
          ? `品牌已同步！你的學員邀請碼：${slug}`
          : "品牌已同步到雲端！"
      );
    } catch (err) {
      console.error("[coach] branding publish error:", err);
      alert("雲端發布失敗，請稍後再試。");
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
      alert("Logo 已上傳到 Supabase 雲端！");
    } catch {
      alert("Logo 處理或上傳失敗。");
    }
    e.target.value = "";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        從雲端載入緊...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 max-w-lg mx-auto">
      <PageHeader
        title={`${appTitle.trim() || brand.gymName} · 教練後台`}
        subtitle={`${appTitle.trim() || brand.appTitle || brand.gymName} · 雲端同步`}
        variant="light"
        backLabel="← 返回主頁"
        onBack={() => router.push("/")}
      />

      <main className="px-4 py-4 space-y-4">
        {session?.role === "coach" && (
          <CoachInviteCodePanel
            inviteCode={inviteCode}
            brandName={appTitle.trim() || brand.gymName}
            loading={loading}
            onCopied={showToast}
          />
        )}

        {(session?.role === "coach" || session?.role === "admin") && (
          <CoachPushSubscribe />
        )}

        {(session?.role === "coach" || session?.role === "admin") && (
          <CoachSelfMealPanel logs={ownMealLogs} />
        )}

        {(session?.role === "coach" || session?.role === "admin") && (
          <ProBillingPanel />
        )}

        {session && (
          <CoachAiReportPanel
            session={session}
            registry={registry}
            gymName={appTitle.trim() || brand.gymName}
            onToast={showToast}
            variant="light"
          />
        )}

        {session?.role === "coach" && (
          <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-4 shadow-sm">
            <h2 className="font-semibold text-zinc-800">品牌中心（雲端）</h2>

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
                <p className="text-sm text-zinc-600">撳一下上傳（即時寫入雲端）</p>
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
              {publishing ? "發布緊..." : "發布到雲端"}
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
  );
}
