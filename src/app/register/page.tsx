"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBranding } from "@/components/BrandingProvider";
import { IosPwaInstallBanner } from "@/components/IosPwaInstallBanner";
import { getDemoUser } from "@/lib/demo-users";
import { isIosSafariBrowser } from "@/lib/ios-pwa";
import { goTo } from "@/lib/navigate";
import { registryUserToSession } from "@/lib/registry";
import { applyBrandToSession } from "@/lib/branding";
import { getSession, saveSession } from "@/lib/session";
import { BRAND_NAME } from "@/lib/brand";
import { initUserRegistry } from "@/lib/registry";
import type { UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export default function RegisterPage() {
  const router = useRouter();
  const brand = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  useEffect(() => {
    const existing = getSession();
    if (existing?.email && existing.isLoggedIn) {
      goTo(router, "/");
      return;
    }
    initUserRegistry().catch(() => undefined);
    setShowIosBanner(isIosSafariBrowser());
  }, [router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      showToast("⚠️ 請先輸入您的 Email！");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, password: password || undefined }),
      });
      const data = (await res.json()) as {
        error?: string;
        session?: UserSession;
      };

      if (res.ok && data.session) {
        saveSession(data.session);
        showToast(`🎉 歡迎 ${data.session.name}`);
        setTimeout(() => goTo(router, "/"), 1200);
        return;
      }

      const demo = getDemoUser(normalized);
      if (demo && !password) {
        const session = applyBrandToSession(registryUserToSession(demo), {
          gymName: demo.appTitle ?? demo.gym,
          branding: {
            appTitle: demo.appTitle ?? demo.gym,
            themeColor: demo.themeColor ?? "emerald",
            logo: demo.logo,
          },
          broadcast: "",
        });
        saveSession(session);
        showToast(`🎉 歡迎 ${demo.name}`);
        setTimeout(() => goTo(router, "/"), 1200);
        return;
      }

      showToast(`❌ ${data.error ?? "登入失敗"}`);
    } catch {
      showToast("❌ 連線失敗，請檢查網絡後再試。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`max-w-lg mx-auto min-h-screen bg-zinc-50 flex flex-col justify-center px-6 pt-safe ${
        showIosBanner ? "pb-44" : "pb-8"
      }`}
    >
      {toast && (
        <div className="fixed top-safe left-4 right-4 z-50 max-w-lg mx-auto bg-zinc-900 text-white px-4 py-3 rounded-xl text-sm font-semibold text-center shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-lg border border-zinc-100 space-y-5">
        <div className="text-center space-y-2">
          {brand.logo ? (
            <img
              src={brand.logo}
              alt=""
              className="h-14 w-14 mx-auto rounded-2xl object-cover shadow-md"
            />
          ) : (
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl shadow-md shadow-emerald-600/30">
              🏋️
            </div>
          )}
          <h1 className="text-xl font-bold text-zinc-900">
            {brand.gymName || BRAND_NAME}
          </h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            專屬飲食打卡系統
            <br />
            請使用教練提供嘅 Email 登入
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-zinc-700 mb-1.5"
            >
              電子郵件
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3.5 font-medium"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-zinc-700 mb-1.5"
            >
              密碼（教練 / 老闆必填）
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="學員可留空"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3.5 font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 bg-zinc-900 text-white font-bold rounded-xl shadow-md disabled:opacity-60 ${btnClass}`}
          >
            {loading ? "驗證緊..." : "登入"}
          </button>
        </form>

        <p className="text-center text-[11px] text-zinc-400 leading-relaxed">
          Gym 老闆？
          <Link href="/sas-register" className="text-emerald-600 font-semibold ml-1">
            免費開通品牌空間
          </Link>
        </p>
      </div>

      <IosPwaInstallBanner />
    </div>
  );
}
