"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPushPermission,
  isPushSupported,
  savePushSubscriptionToSupabase,
  showLocalTestNotification,
  subscribeToPush,
  subscriptionToPayload,
  unsubscribeFromPush,
} from "@/lib/push-notifications";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Status = "idle" | "loading" | "enabled" | "denied" | "error";

export function PushReminderToggle() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<string>("default");

  const refresh = useCallback(async () => {
    setSupported(isPushSupported());
    setPermission(getPushPermission());
    if (!isPushSupported()) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "enabled" : "idle");
    } catch {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEnable = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const subscription = await subscribeToPush();
      try {
        await savePushSubscriptionToSupabase(subscription);
        setMessage("✅ 已開啟系統通知，訂閱已存入 Supabase。");
      } catch {
        const payload = subscriptionToPayload(subscription);
        console.info("[Nutrition Coach] PushSubscription（請存入 Supabase）:", payload);
        setMessage(
          "✅ 已開啟通知。Supabase 表未建立，訂閱已印在 Console（F12）供你複製。"
        );
      }
      setStatus("enabled");
      setPermission("granted");
    } catch (error) {
      const text = error instanceof Error ? error.message : "開啟失敗";
      setStatus(text.includes("未允許") ? "denied" : "error");
      setMessage(`❌ ${text}`);
      setPermission(getPushPermission());
    }
  };

  const handleDisable = async () => {
    setStatus("loading");
    try {
      await unsubscribeFromPush();
      setStatus("idle");
      setMessage("已關閉推送訂閱。");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "關閉失敗");
      setStatus("error");
    }
  };

  const handleTest = async () => {
    try {
      await showLocalTestNotification();
      setMessage("📲 已發送本機測試通知（若無彈出，請檢查系統通知設定）。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "測試失敗");
    }
  };

  if (!supported) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold">📲 系統通知</p>
        <p className="mt-1">
          此裝置或瀏覽器唔支援 Web Push。iPhone 請用 Safari「加入主畫面」後，喺主畫面圖示開啟（iOS 16.4+）。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
      <div>
        <p className="font-semibold text-sm text-emerald-900">📲 飲水與飲食提醒</p>
        <p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
          開啟後即使閂咗 App，都可收到系統通知（需 Vercel 設定 VAPID 公鑰 + Supabase 儲存訂閱）。
        </p>
        <p className="text-[10px] text-emerald-700/70 mt-1">
          權限狀態：{permission}
          {status === "enabled" ? " · 已訂閱" : ""}
        </p>
      </div>

      {status !== "enabled" ? (
        <button
          type="button"
          disabled={status === "loading" || permission === "denied"}
          onClick={handleEnable}
          className={`w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 ${btnClass}`}
        >
          {status === "loading" ? "處理緊..." : "🔔 開啟飲水與飲食提醒"}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTest}
            className={`flex-1 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold ${btnClass}`}
          >
            測試通知
          </button>
          <button
            type="button"
            onClick={handleDisable}
            className={`flex-1 py-2.5 rounded-xl bg-zinc-200 text-zinc-700 text-xs font-semibold ${btnClass}`}
          >
            關閉
          </button>
        </div>
      )}

      {permission === "denied" && (
        <p className="text-xs text-red-600">
          你之前拒絕咗通知。請去 設定 → Safari/Chrome → 通知 → 允許 Nutrition Coach。
        </p>
      )}

      {message && (
        <p className="text-xs text-emerald-900 bg-white/60 rounded-lg px-2 py-1.5">{message}</p>
      )}
    </div>
  );
}
