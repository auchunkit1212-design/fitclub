"use client";

import { useEffect, useState } from "react";
import { useBranding } from "@/components/BrandingProvider";
import { isIosSafariBrowser } from "@/lib/ios-pwa";
import { isStandaloneDisplay } from "@/lib/session";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export function IosPwaInstallBanner() {
  const brand = useBranding();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      if (isStandaloneDisplay()) {
        setVisible(false);
        return;
      }
      setVisible(isIosSafariBrowser());
    };

    check();
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
      role="region"
      aria-label="安裝 App 提示"
    >
      <div className="max-w-lg mx-auto pointer-events-auto">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-2xl shadow-emerald-900/25">
          <div
            className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <div
            className="absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-teal-300/20 blur-xl"
            aria-hidden
          />

          <div className="relative px-4 py-4 pr-10">
            <button
              type="button"
              onClick={() => setVisible(false)}
              className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/90 text-lg leading-none ${btnClass}`}
              aria-label="關閉提示"
            >
              ×
            </button>

            <p className="text-sm font-bold tracking-tight">📲 安裝 {brand.gymName} 專屬 App</p>
            <p className="mt-2 text-[13px] leading-relaxed text-emerald-50/95">
              為了獲得專屬健康管理體驗，請點擊瀏覽器底部的
              <span className="mx-1 inline-flex items-center rounded-md bg-white/20 px-1.5 py-0.5 font-semibold text-white">
                分享
              </span>
              按鈕（正方形向上箭頭
              <span className="mx-0.5 inline-block align-middle text-base" aria-hidden>
                ↑
              </span>
              ），然後選擇
              <span className="mx-1 inline-flex items-center rounded-md bg-white/20 px-1.5 py-0.5 font-semibold text-white">
                加至主畫面
              </span>
              ！
            </p>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-100/90">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 text-xs">
                1
              </span>
              <span>撳分享</span>
              <span className="text-white/40">→</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 text-xs">
                2
              </span>
              <span>加至主畫面</span>
              <span className="text-white/40">→</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 text-xs">
                3
              </span>
              <span>用主畫面圖示開啟</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
