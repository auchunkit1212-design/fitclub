"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IosPwaInstallBanner } from "@/components/IosPwaInstallBanner";
import { getDemoUser } from "@/lib/demo-users";
import { isIosSafariBrowser } from "@/lib/ios-pwa";
import { goTo } from "@/lib/navigate";
import {
  SUPER_ADMIN_EMAIL,
  createAdminSession,
  fetchUserByEmail,
  initUserRegistry,
  registryUserToSession,
} from "@/lib/registry";
import { getSession, saveSession } from "@/lib/session";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  useEffect(() => {
    const existing = getSession();
    if (existing?.email && existing.isLoggedIn) {
      goTo(router, "/");
      return;
    }
    initUserRegistry().catch(() => {
      // Seed may fail if RLS not configured yet
    });
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
      if (normalized === SUPER_ADMIN_EMAIL) {
        saveSession(createAdminSession(normalized));
        showToast("👑 歡迎回來！");
        setTimeout(() => goTo(router, "/"), 1200);
        return;
      }

      const foundUser = await fetchUserByEmail(normalized);
      if (foundUser) {
        saveSession(registryUserToSession(foundUser));
        const roleLabel = foundUser.role === "coach" ? "教練" : "學員";
        showToast(`🎉 歡迎 ${foundUser.name}（${roleLabel}）`);
        setTimeout(() => goTo(router, "/"), 1200);
        return;
      }

      showToast("❌ 此 Email 尚未獲授權，請聯絡您的教練或健身房登記。");
    } catch (err) {
      const demo = getDemoUser(normalized);
      if (demo) {
        saveSession(registryUserToSession(demo));
        showToast(`🎉 歡迎 ${demo.name}`);
        setTimeout(() => goTo(router, "/"), 1200);
        return;
      }
      const msg = err instanceof Error ? err.message : "";
      showToast(
        msg.includes("42501") || msg.toLowerCase().includes("row-level")
          ? "❌ 系統維護中，請稍後再試或聯絡客服。"
          : "❌ 連線失敗，請檢查網絡後再試。"
      );
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
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl shadow-md shadow-emerald-600/30">
            🏋️
          </div>
          <h1 className="text-xl font-bold text-zinc-900">FitClub 健康管理</h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            連鎖健身房專屬飲食打卡系統
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
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3.5 font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
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
          未有帳號？請向所屬分店教練或管理員申請開通。
        </p>
      </div>

      <IosPwaInstallBanner />
    </div>
  );
}
