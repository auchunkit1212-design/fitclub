"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GorillaMascot } from "@/components/GorillaMascot";
import { IosPwaInstallBanner } from "@/components/IosPwaInstallBanner";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getDemoUser } from "@/lib/demo-users";
import { isIosSafariBrowser } from "@/lib/ios-pwa";
import { goTo } from "@/lib/navigate";
import { applyBrandToSession } from "@/lib/branding";
import { registryUserToSession } from "@/lib/registry";
import { initUserRegistry } from "@/lib/registry";
import { getSession, saveSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import type { UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type RegisterMode = "lobby" | "coach" | "student" | "login";

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<RegisterMode>("lobby");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gymName, setGymName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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
    setTimeout(() => setToast(""), 3500);
  };

  const finishSession = (session: UserSession, welcome: string) => {
    saveSession(session);
    showToast(welcome);
    setTimeout(() => goTo(router, "/"), 1200);
  };

  const syncSupabaseAuthClient = async (userEmail: string, userPassword: string) => {
    try {
      await supabase.auth.signUp({
        email: userEmail,
        password: userPassword,
      });
    } catch {
      // registry + cookie session 仍可用
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: mode === "coach" ? "coach" : "student",
          email,
          password,
          name,
          gymName: mode === "coach" ? gymName : undefined,
          inviteCode: mode === "student" && inviteCode.trim() ? inviteCode.trim() : undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        session?: UserSession;
        gymName?: string;
      };

      if (!res.ok || !data.session) {
        showToast(`❌ ${data.error ?? "註冊失敗"}`);
        return;
      }

      await syncSupabaseAuthClient(email.trim().toLowerCase(), password);
      finishSession(
        data.session,
        mode === "coach"
          ? `🎉 品牌「${data.gymName ?? gymName}」已開通！`
          : `🎉 歡迎加入 ${BRAND_NAME}！`
      );
    } catch {
      showToast("❌ 連線失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
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
        credentials: "include",
        body: JSON.stringify({ email: normalized, password: password || undefined }),
      });
      const data = (await res.json()) as {
        error?: string;
        session?: UserSession;
      };

      if (res.ok && data.session) {
        finishSession(data.session, `🎉 歡迎 ${data.session.name}`);
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
        finishSession(session, `🎉 歡迎 ${demo.name}`);
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
      className={`max-w-lg mx-auto min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-emerald-950 flex flex-col justify-center px-6 pt-safe ${
        showIosBanner ? "pb-44" : "pb-8"
      }`}
    >
      {toast && (
        <div className="fixed top-safe left-4 right-4 z-50 max-w-lg mx-auto bg-white text-zinc-900 px-4 py-3 rounded-xl text-sm font-semibold text-center shadow-2xl">
          {toast}
        </div>
      )}

      <div className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <GorillaMascot themeColor="emerald" size="md" />
        </div>
        <p className="text-emerald-300/90 text-xs font-semibold tracking-wide">
          {BRAND_TAGLINE}
        </p>
        <h1 className="text-2xl font-black text-white mt-2">{BRAND_NAME}</h1>
        <p className="text-zinc-400 text-sm mt-1">B2B 教練平台 · B2C 散客 AI 私教</p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-zinc-100 space-y-5">
        {mode === "lobby" && (
          <>
            <p className="text-center text-sm text-zinc-600 font-medium">
              選擇你的身份開始
            </p>
            <button
              type="button"
              onClick={() => setMode("coach")}
              className={`w-full text-left p-4 rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 to-white hover:border-indigo-300 ${btnClass}`}
            >
              <p className="text-lg font-bold text-indigo-950">🏢 我是教練 / 健身房老闆</p>
              <p className="text-xs text-indigo-700/80 mt-1 leading-relaxed">
                開通專屬 Tenant 品牌空間，管理學員飲食與推送
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("student")}
              className={`w-full text-left p-4 rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-300 ${btnClass}`}
            >
              <p className="text-lg font-bold text-emerald-950">🥗 我是學員 (想記錄飲食)</p>
              <p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
                無教練都可加入 · 大猩猩 AI 私教自動制定目標同批閱
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`w-full py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold text-sm ${btnClass}`}
            >
              已有帳號？登入
            </button>
          </>
        )}

        {(mode === "coach" || mode === "student") && (
          <form onSubmit={handleRegister} className="space-y-4">
            <button
              type="button"
              onClick={() => setMode("lobby")}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              ← 返回選擇身份
            </button>
            <h2 className="text-lg font-bold text-zinc-900">
              {mode === "coach" ? "教練 / 品牌註冊" : "學員註冊"}
            </h2>

            {mode === "coach" && (
              <input
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="Gym 品牌名稱（例如 Oxygym）"
                required
                className="w-full rounded-xl border border-zinc-200 px-3 py-3"
              />
            )}

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "coach" ? "教練姓名" : "你的姓名"}
              required
              className="w-full rounded-xl border border-zinc-200 px-3 py-3"
            />

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密碼（至少 6 位）"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3"
            />

            {mode === "student" && (
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="教練邀請碼（選填，Tenant slug）"
                className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm"
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-white disabled:opacity-60 ${
                mode === "coach" ? "bg-indigo-600" : "bg-emerald-600"
              } ${btnClass}`}
            >
              {loading ? "註冊中..." : mode === "coach" ? "🚀 建立品牌空間" : "🦍 開始 AI 私教之旅"}
            </button>
          </form>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <button
              type="button"
              onClick={() => setMode("lobby")}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              ← 返回選擇身份
            </button>
            <h2 className="text-lg font-bold text-zinc-900">登入</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密碼（學員可留空若未設定）"
              autoComplete="current-password"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3"
            />
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 bg-zinc-900 text-white font-bold rounded-xl disabled:opacity-60 ${btnClass}`}
            >
              {loading ? "驗證緊..." : "登入"}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-[11px] text-zinc-500 mt-4 leading-relaxed">
        註冊即表示同意使用 Supabase Auth 安全登入 ·{" "}
        <Link href="/sas-register" className="text-emerald-400 underline">
          舊版 B2B 開通頁
        </Link>
      </p>

      <IosPwaInstallBanner />
    </div>
  );
}
