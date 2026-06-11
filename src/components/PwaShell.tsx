"use client";

import { useEffect, useState } from "react";
import { useBranding } from "@/components/BrandingProvider";
import { IconLabel, Smartphone } from "@/components/icons";
import { syncSessionPlan } from "@/lib/plan-client";
import { isStandaloneDisplay } from "@/lib/session";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaShell() {
  const brand = useBranding();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [showStandaloneLoginHint, setShowStandaloneLoginHint] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [installed, setInstalled] = useState(false);

  const dismissStandaloneLoginHint = () => {
    if (dontShowAgain && typeof window !== "undefined") {
      localStorage.setItem("hidePwaWarning", "true");
    }
    setShowStandaloneLoginHint(false);
  };

  useEffect(() => {
    const syncPlan = () => {
      if (document.visibilityState !== "visible") return;
      void syncSessionPlan();
    };
    void syncSessionPlan();
    document.addEventListener("visibilitychange", syncPlan);
    return () => document.removeEventListener("visibilitychange", syncPlan);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.update().catch(() => undefined);
        })
        .catch(() => {
          // Service worker registration can fail on insecure contexts
        });
    }

    const standalone = isStandaloneDisplay();
    if (standalone) {
      setInstalled(true);
      const hideWarning =
        typeof window !== "undefined" &&
        localStorage.getItem("hidePwaWarning") === "true";
      if (!hideWarning) {
        setShowStandaloneLoginHint(true);
      }
      return;
    }

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !("onbeforeinstallprompt" in window);
    if (isIos) {
      setShowIosHint(true);
    }

    const onInstallable = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onInstallable);
    return () => window.removeEventListener("beforeinstallprompt", onInstallable);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallEvent(null);
  };

  return (
    <>
      {showStandaloneLoginHint && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-4 py-3 shadow-lg text-xs leading-relaxed">
            <p className="font-bold">
              <IconLabel icon={Smartphone} size="sm" iconClassName="text-amber-900">
                主畫面 App 提示
              </IconLabel>
            </p>
            <p className="mt-1">
              主畫面圖示同 Safari 分開儲存登入狀態。若見唔到資料，請喺呢度重新登入一次。
            </p>
            <label className="mt-3 flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-5 w-5 shrink-0 rounded border-amber-400 text-amber-700 focus:ring-amber-500 focus:ring-offset-0"
              />
              <span className="text-[11px] text-gray-600 leading-snug">
                以後不再提醒 (Don&apos;t show again)
              </span>
            </label>
            <button
              type="button"
              onClick={dismissStandaloneLoginHint}
              className={`mt-1 w-full py-2.5 rounded-lg bg-amber-200 font-medium ${btnClass}`}
            >
              知道喇
            </button>
          </div>
        </div>
      )}

      {!installed && installEvent && (
        <div className="fixed bottom-24 left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-2xl border border-zinc-700">
            <p className="text-sm font-semibold">
              <IconLabel icon={Smartphone} size="sm" iconClassName="text-white">
                安裝 {brand.gymName} App
              </IconLabel>
            </p>
            <p className="text-xs text-zinc-300 mt-1">
              加到主畫面，全屏使用，似真 App 咁順！
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setInstallEvent(null)}
                className={`flex-1 py-2 rounded-lg bg-zinc-700 text-xs font-medium ${btnClass}`}
              >
                稍後
              </button>
              <button
                type="button"
                onClick={handleInstall}
                className={`flex-1 py-2 rounded-lg bg-emerald-600 text-xs font-bold ${btnClass}`}
              >
                立即安裝
              </button>
            </div>
          </div>
        </div>
      )}

      {!installed && showIosHint && !installEvent && (
        <div className="fixed bottom-24 left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-2xl border border-zinc-700">
            <p className="text-sm font-semibold">
              <IconLabel icon={Smartphone} size="sm" iconClassName="text-white">
                iPhone 安裝教學
              </IconLabel>
            </p>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
              Safari 分享掣 →「加入主畫面」。安裝後請用主畫面圖示開啟，並重新登入一次。
            </p>
            <button
              type="button"
              onClick={() => setShowIosHint(false)}
              className={`mt-3 w-full py-2 rounded-lg bg-zinc-700 text-xs font-medium ${btnClass}`}
            >
              知道喇
            </button>
          </div>
        </div>
      )}
    </>
  );
}
