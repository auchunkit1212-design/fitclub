"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildLogSummary, generateCoachReport } from "@/lib/ai-mock";
import {
  fetchAllUsers,
  fetchMealLogsForSession,
  resolveBranding,
  updateCoachBranding,
  updateCoachLogo,
} from "@/lib/db";
import { compressFileImage } from "@/lib/image";
import { getSession } from "@/lib/session";
import type { CoachBranding, MealLog, ThemeColor, UserSession } from "@/lib/types";
import { DEFAULT_BRANDING } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const THEME_OPTIONS: { value: ThemeColor; label: string }[] = [
  { value: "emerald", label: "翠綠 (Emerald)" },
  { value: "blue", label: "藍色 (Blue)" },
  { value: "black", label: "黑色 (Black)" },
];

function mealStatus(log: MealLog): "優良" | "危險" {
  if (log.calories >= 700) return "危險";
  if (log.calories <= 500 && log.protein >= 20) return "優良";
  return "危險";
}

export default function CoachPage() {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [appTitle, setAppTitle] = useState("");
  const [themeColor, setThemeColor] = useState<ThemeColor>("emerald");
  const [logo, setLogo] = useState<string | undefined>();
  const [broadcast, setBroadcast] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const load = async () => {
      const current = getSession();
      if (!current || (current.role !== "coach" && current.role !== "admin")) {
        router.push("/register");
        return;
      }

      setSession(current);

      try {
        const registry = await fetchAllUsers();
        const mealLogs = await fetchMealLogsForSession(current, registry);
        setLogs(mealLogs);

        if (current.role === "coach") {
          const resolved = await resolveBranding(current, registry);
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
      await updateCoachBranding(session.email, {
        appTitle: appTitle.trim() || DEFAULT_BRANDING.appTitle,
        themeColor,
        logo,
        broadcast: broadcast.trim(),
      });
      alert("已同步到 Supabase 雲端！");
    } catch {
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
      await updateCoachLogo(session.email, compressed);
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
      const registry = await fetchAllUsers();
      const freshLogs = await fetchMealLogsForSession(session, registry);
      setLogs(freshLogs);
      setAiReport(generateCoachReport(freshLogs));
    } catch {
      alert("無法從 Supabase 拉取學員飲食記錄。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (log: MealLog) => {
    const text = buildLogSummary(log);
    try {
      await navigator.clipboard.writeText(text);
      setCopyId(log.id);
      setTimeout(() => setCopyId(null), 2000);
    } catch {
      alert("複製失敗，請檢查瀏覽器權限。");
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
    <div className="min-h-screen bg-zinc-50 pb-8 max-w-lg mx-auto">
      <header className="bg-zinc-900 text-white px-4 py-5">
        <button
          type="button"
          onClick={() => router.push("/")}
          className={`text-sm text-white/80 mb-3 px-3 py-1.5 rounded-lg bg-white/10 ${btnClass}`}
        >
          ← 返回主頁
        </button>
        <h1 className="text-xl font-bold">教練白標後台</h1>
        <p className="text-white/70 text-sm mt-1">Supabase 雲端同步</p>
      </header>

      <main className="px-4 py-4 space-y-4">
        <section className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-lg space-y-3">
          <h2 className="text-sm font-bold text-indigo-200">
            🤖 AI 數據智能整合中心
          </h2>
          <button
            type="button"
            disabled={isGenerating}
            onClick={generateAIReport}
            className={`w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl disabled:opacity-60 ${btnClass}`}
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
              className={`w-full bg-zinc-900 text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 ${btnClass}`}
            >
              {publishing ? "發布緊..." : "發布到雲端"}
            </button>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
          <h2 className="font-semibold text-zinc-800 mb-3">
            學員飲食記錄 ({logs.length})
          </h2>

          {logs.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">
              暫時未有記錄，等學員記低第一餐先！
            </p>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => {
                const status = mealStatus(log);
                return (
                  <li
                    key={log.id}
                    className="border border-zinc-100 rounded-xl p-3 bg-zinc-50"
                  >
                    <div className="flex gap-3 justify-between">
                      <div className="flex gap-3 min-w-0 flex-1">
                        {log.imageBase64 && (
                          <img
                            src={log.imageBase64}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {log.mealType} · {log.description}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {log.email} · {new Date(log.date).toLocaleString("zh-HK")} ·{" "}
                            {log.calories} kcal
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                          status === "優良"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(log)}
                      className={`mt-2 w-full text-sm font-medium py-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 ${btnClass}`}
                    >
                      {copyId === log.id ? "✅ 已複製！" : "📋 一鍵複製"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
