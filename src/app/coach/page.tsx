"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { generateCoachReport } from "@/lib/ai-mock";
import { CoachPushSubscribe } from "@/components/CoachPushSubscribe";
import { CoachActivityWall } from "@/components/CoachActivityWall";
import { CoachInviteCodePanel } from "@/components/CoachInviteCodePanel";
import { CoachMealHistoryPanel } from "@/components/CoachMealHistoryPanel";
import { useBranding } from "@/components/BrandingProvider";
import {
  fetchMealLogsForSession,
  fetchUsersForSession,
  filterStudentsForSession,
  resolveBranding,
  updateCoachLogo,
} from "@/lib/db";
import { applyBrandToSession, resolveBrandForUser } from "@/lib/branding";
import { saveSession, getSessionRequestHeaders } from "@/lib/session";
import { compressFileImage } from "@/lib/image";
import { PageHeader } from "@/components/PageHeader";
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
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [students, setStudents] = useState<RegistryUser[]>([]);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
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
        const registry = await fetchUsersForSession(current);
        const mealLogs = await fetchMealLogsForSession(current, registry);
        setLogs(mealLogs);
        setStudents(filterStudentsForSession(current, registry));

        if (current.role === "coach") {
          const brandResolved = await resolveBrandForUser(current, registry);
          const resolved = await resolveBranding(current, registry);
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
      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        console.error("[coach] branding publish failed:", data);
        alert(
          data.hint
            ? `${data.error ?? "雲端發布失敗"}\n\n${data.hint}`
            : data.error ?? "雲端發布失敗，請稍後再試。"
        );
        return;
      }
      const updated = applyBrandToSession(session, {
        gymName: appTitle.trim(),
        branding: { appTitle: appTitle.trim(), themeColor, logo },
        broadcast: broadcast.trim(),
        tenantSlug: inviteCode.trim() || session.tenantSlug,
      });
      saveSession(updated);
      alert("品牌已同步到雲端！");
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

  const generateAIReport = async () => {
    if (!session) return;
    setIsGenerating(true);
    setAiReport(null);
    try {
      const registry = await fetchUsersForSession(session);
      const freshLogs = await fetchMealLogsForSession(session, registry);
      setLogs(freshLogs);
      setAiReport(generateCoachReport(freshLogs));
    } catch {
      alert("無法從 Supabase 拉取學員飲食記錄。");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        從雲端載入緊...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-safe max-w-lg mx-auto">
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

        <section className="bg-white border border-gray-200 rounded-2xl p-4 shadow-md space-y-3">
          <h2 className="text-sm font-bold text-emerald-700">
            🤖 AI 數據智能整合中心
          </h2>
          <button
            type="button"
            disabled={isGenerating}
            onClick={generateAIReport}
            className={`w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl disabled:opacity-60 ${btnClass}`}
          >
            {isGenerating ? "⏳ 從 Supabase 整合緊..." : "📊 一鍵 AI 整合學員飲食記錄"}
          </button>
          {aiReport && (
            <pre className="bg-white/10 p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap border border-white/10">
              {aiReport}
            </pre>
          )}
        </section>

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

        {session?.role === "coach" && students.length > 0 && (
          <CoachActivityWall
            logs={logs}
            students={students}
            onToast={showToast}
          />
        )}

        <CoachMealHistoryPanel
          logs={logs}
          students={students}
          gymName={brand.gymName}
        />
      </main>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto bg-white border border-gray-200 text-gray-900 text-sm text-center py-3 rounded-xl z-50 shadow-md">
          {toast}
        </div>
      )}
    </div>
  );
}
