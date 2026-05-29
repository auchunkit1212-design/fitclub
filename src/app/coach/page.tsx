"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildLogSummary, generateCoachReport } from "@/lib/ai-mock";
import { compressFileImage } from "@/lib/image";
import {
  getCoachBranding,
  getCoachBroadcast,
  getMealLogs,
  saveCoachBranding,
  saveCoachBroadcast,
} from "@/lib/storage";
import type { CoachBranding, MealLog, ThemeColor } from "@/lib/types";

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

  const [appTitle, setAppTitle] = useState("");
  const [themeColor, setThemeColor] = useState<ThemeColor>("emerald");
  const [logo, setLogo] = useState<string | undefined>();
  const [broadcast, setBroadcast] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const branding = getCoachBranding();
    setAppTitle(branding.appTitle);
    setThemeColor(branding.themeColor);
    setLogo(branding.logo);
    setBroadcast(getCoachBroadcast());
    setLogs(getMealLogs());
  }, []);

  const handlePublish = () => {
    const branding: CoachBranding = {
      appTitle: appTitle.trim() || "健身飲食追蹤",
      themeColor,
      logo,
    };
    saveCoachBranding(branding);
    saveCoachBroadcast(broadcast.trim());
    alert("已發布品牌設定、Logo 同緊急廣播！");
  };

  const handleLogoPick = () => {
    logoInputRef.current?.click();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressFileImage(file);
      setLogo(compressed);
      alert("Logo 上傳成功，記得撳「發布」同步去學員主頁。");
    } catch {
      alert("Logo 處理失敗，請再試一次。");
    }
    e.target.value = "";
  };

  const generateAIReport = () => {
    setIsGenerating(true);
    setAiReport(null);
    setTimeout(() => {
      setAiReport(generateCoachReport(logs));
      setIsGenerating(false);
    }, 1000);
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
        <p className="text-white/70 text-sm mt-1">品牌、AI 報告、學員飲食記錄</p>
      </header>

      <main className="px-4 py-4 space-y-4">
        <section className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-lg space-y-3">
          <h2 className="text-sm font-bold text-indigo-200">
            🤖 AI 數據智能整合中心
          </h2>
          <p className="text-xs text-indigo-100/90">
            一鍵分析學員最新飲食打卡，生成廣東話教練報告。
          </p>
          <button
            type="button"
            disabled={isGenerating}
            onClick={generateAIReport}
            className={`w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl disabled:opacity-60 ${btnClass}`}
          >
            {isGenerating ? "⏳ AI 整合緊..." : "📊 一鍵 AI 整合學員飲食記錄"}
          </button>
          {aiReport && (
            <pre className="bg-white/10 p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap border border-white/10">
              {aiReport}
            </pre>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-4 shadow-sm">
          <h2 className="font-semibold text-zinc-800">品牌中心</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              App 標題
            </label>
            <input
              type="text"
              value={appTitle}
              onChange={(e) => setAppTitle(e.target.value)}
              placeholder="例如：阿強健身室飲食計劃"
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
              <p className="text-sm text-zinc-600">撳一下上傳 Logo（自動壓縮）</p>
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
              placeholder="例如：聽日記得帶水壺，高溫警告！"
              rows={3}
              className="w-full rounded-xl border border-zinc-200 px-3 py-3 resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handlePublish}
            className={`w-full bg-zinc-900 text-white font-semibold py-3.5 rounded-xl ${btnClass}`}
          >
            發布
          </button>
        </section>

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
                            {new Date(log.date).toLocaleString("zh-HK")} ·{" "}
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
