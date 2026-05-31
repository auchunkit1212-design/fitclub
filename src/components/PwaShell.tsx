"use client";

import { useEffect, useState } from "react";
import { useBranding } from "@/components/BrandingProvider";
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
  const [installed, setInstalled] = useState(false);

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
      setShowStandaloneLoginHint(true);
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
            <p className="font-bold">📲 主畫面 App 提示</p>
            <p className="mt-1">
              主畫面圖示同 Safari 分開儲存登入狀態。若見唔到資料，請喺呢度重新登入一次。
            </p>
            <button
              type="button"
              onClick={() => setShowStandaloneLoginHint(false)}
              className={`mt-2 w-full py-2 rounded-lg bg-amber-200 font-medium ${btnClass}`}
            >
              知道喇
            </button>
          </div>
        </div>
      )}

      {!installed && installEvent && (
        <div className="fixed bottom-24 left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-2xl border border-zinc-700">
            <p className="text-sm font-semibold">📲 安裝 {brand.gymName} App</p>
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
            <p className="text-sm font-semibold">📲 iPhone 安裝教學</p>
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
