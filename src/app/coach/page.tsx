"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildLogSummary } from "@/lib/ai-mock";
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

export default function CoachPage() {
  const router = useRouter();
  const [appTitle, setAppTitle] = useState("");
  const [themeColor, setThemeColor] = useState<ThemeColor>("emerald");
  const [broadcast, setBroadcast] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [copyId, setCopyId] = useState<string | null>(null);

  useEffect(() => {
    const branding = getCoachBranding();
    setAppTitle(branding.appTitle);
    setThemeColor(branding.themeColor);
    setBroadcast(getCoachBroadcast());
    setLogs(getMealLogs());
  }, []);

  const handlePublish = () => {
    const branding: CoachBranding = {
      appTitle: appTitle.trim() || "健身飲食追蹤",
      themeColor,
    };
    saveCoachBranding(branding);
    saveCoachBroadcast(broadcast.trim());
    alert("已發布品牌設定同緊急廣播！");
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
          ← 返回學員主頁
        </button>
        <h1 className="text-xl font-bold">教練白標後台</h1>
        <p className="text-white/70 text-sm mt-1">自訂 App 品牌同檢視學員記錄</p>
      </header>

      <main className="px-4 py-4 space-y-4">
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
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="border border-zinc-100 rounded-xl p-3 bg-zinc-50"
                >
                  <div className="flex gap-3">
                    {log.imageBase64 && (
                      <img
                        src={log.imageBase64}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {log.mealType} · {log.description}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(log.date).toLocaleString("zh-HK")} ·{" "}
                        {log.calories} kcal
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(log)}
                    className={`mt-2 w-full text-sm font-medium py-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 ${btnClass}`}
                  >
                    {copyId === log.id ? "✅ 已複製！" : "📋 一鍵複製"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
