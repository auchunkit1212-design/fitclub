"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GorillaMascot } from "@/components/GorillaMascot";
import { IosPwaInstallBanner } from "@/components/IosPwaInstallBanner";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getDemoUser } from "@/lib/demo-users";
import { isIosSafariBrowser } from "@/lib/ios-pwa";
import { goTo } from "@/lib/navigate";
import { applyBrandToSession } from "@/lib/branding";
import { buildSessionFromRegistryUser } from "@/lib/auth";
import {
  createAdminSession,
  fetchUserByEmail,
  registryUserToSession,
  initUserRegistry,
} from "@/lib/registry";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import { getSession, saveSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import type { UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type AuthTab = "login" | "signup";
type SignupTrack = "solo" | "coach";

export default function RegisterPage() {
  const router = useRouter();
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [signupTrack, setSignupTrack] = useState<SignupTrack>("solo");
  const [email, setEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [name, setName] = useState("");
  const [gymName, setGymName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showInviteField, setShowInviteField] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
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

  const welcomeText = useMemo(() => {
    if (authTab === "login") {
      return "歡迎回來！登入後繼續記錄飲食同 AI 分析。";
    }
    if (signupTrack === "solo") {
      return "無教練都可加入 — 大猩猩 AI 私教會幫你設定目標同批閱每一餐。";
    }
    return "開通你的 Gym 品牌空間，開始管理學員飲食。";
  }, [authTab, signupTrack]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const finishSession = (session: UserSession, welcome: string) => {
    saveSession(session);
    showToast(welcome);
    setTimeout(() => goTo(router, "/"), 1200);
  };

  const syncSupabaseAuthOnRegister = async (
    userEmail: string,
    userPassword: string
  ) => {
    try {
      await supabase.auth.signUp({ email: userEmail, password: userPassword });
    } catch (err) {
      console.warn("[register] Supabase Auth signUp skipped:", err);
    }
  };

  const tryLegacyPasswordlessLogin = async (normalized: string): Promise<boolean> => {
    if (loginPassword.trim()) return false;

    if (normalized === SUPER_ADMIN_EMAIL) {
      finishSession(createAdminSession(normalized), "🎉 歡迎 最高總裁");
      return true;
    }

    try {
      const user = await fetchUserByEmail(normalized);
      if (user && !user.hasPassword) {
        const session = await buildSessionFromRegistryUser(user);
        finishSession(session, `🎉 歡迎 ${session.name}`);
        return true;
      }
    } catch (legacyErr) {
      console.error("Legacy passwordless login failed:", legacyErr);
    }

    const demo = getDemoUser(normalized);
    if (demo) {
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
      return true;
    }

    return false;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (signupPassword.length < 6) {
      showToast("⚠️ 請設定至少 6 位密碼。");
      return;
    }

    setLoading(true);
    try {
      const isCoach = signupTrack === "coach";
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: isCoach ? "coach" : "student",
          email,
          password: signupPassword,
          name,
          gymName: isCoach ? gymName : undefined,
          inviteCode:
            !isCoach && showInviteField && inviteCode.trim()
              ? inviteCode.trim()
              : undefined,
          soloStudent: !isCoach && !showInviteField,
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

      await syncSupabaseAuthOnRegister(email.trim().toLowerCase(), signupPassword);
      finishSession(
        data.session,
        isCoach
          ? `🎉 品牌「${data.gymName ?? gymName}」已開通！`
          : "🦍 歡迎！AI 大猩猩私教已為你準備好 onboarding。"
      );
    } catch (err) {
      console.error("Register failed:", err);
      showToast("❌ 連線失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setLoginError("請先輸入 Email。");
      showToast("⚠️ 請先輸入 Email。");
      return;
    }

    setLoginError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: normalized,
          password: loginPassword.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        session?: UserSession;
      };

      if (res.ok && data.session) {
        finishSession(data.session, `🎉 歡迎 ${data.session.name}`);
        return;
      }

      const apiError = data.error ?? "登入失敗";
      console.error("Login failed:", apiError);

      if (await tryLegacyPasswordlessLogin(normalized)) {
        return;
      }

      setLoginError(apiError);
      showToast(`❌ ${apiError}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "連線失敗";
      console.error("Login failed:", message, err);

      if (await tryLegacyPasswordlessLogin(normalized)) {
        return;
      }

      setLoginError(message);
      showToast("❌ 連線失敗，請檢查網絡後再試。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`max-w-lg mx-auto min-h-screen bg-white flex flex-col justify-center px-6 pt-safe ${
        showIosBanner ? "pb-44" : "pb-8"
      }`}
    >
      {toast && (
        <div className="fixed top-safe left-4 right-4 z-50 max-w-lg mx-auto bg-white text-zinc-900 px-4 py-3 rounded-xl text-sm font-semibold text-center shadow-2xl">
          {toast}
        </div>
      )}

      <div className="text-center mb-5">
        <div className="flex justify-center mb-3">
          <GorillaMascot themeColor="emerald" size="md" />
        </div>
        <p className="text-emerald-300/90 text-xs font-semibold tracking-wide">
          {BRAND_TAGLINE}
        </p>
        <h1 className="text-2xl font-black text-gray-900 mt-2">{BRAND_NAME}</h1>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-2xl border border-zinc-100 space-y-4">
        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-xl">
          {(
            [
              ["login", "登入 Login"],
              ["signup", "註冊 Sign Up"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setAuthTab(tab);
                setLoginError(null);
              }}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all ${btnClass} ${
                authTab === tab
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-sm text-zinc-600 text-center leading-relaxed px-1">
          {welcomeText}
        </p>

        {authTab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
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
              value={loginPassword}
              onChange={(e) => {
                setLoginPassword(e.target.value);
                setLoginError(null);
              }}
              placeholder="密碼（舊學員若未設定可留空）"
              autoComplete="current-password"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3"
            />
            {loginError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 bg-[#7ED321] text-white font-bold rounded-xl disabled:opacity-60 ${btnClass}`}
            >
              {loading ? "驗證緊..." : "登入"}
            </button>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSignupTrack("solo");
                  setShowInviteField(false);
                }}
                className={`py-2 rounded-xl text-xs font-bold border-2 ${btnClass} ${
                  signupTrack === "solo"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-zinc-200 text-zinc-600"
                }`}
              >
                🦍 AI 私教散客
              </button>
              <button
                type="button"
                onClick={() => setSignupTrack("coach")}
                className={`py-2 rounded-xl text-xs font-bold border-2 ${btnClass} ${
                  signupTrack === "coach"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                    : "border-zinc-200 text-zinc-600"
                }`}
              >
                🏢 教練 / 品牌
              </button>
            </div>

            {signupTrack === "solo" && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                <p className="text-sm font-bold text-emerald-900">
                  註冊 AI 專屬私教（無須教練）
                </p>
                <p className="text-[11px] text-emerald-800/80 mt-0.5">
                  密碼必填 · 自動接入官方 AI Tenant · 大猩猩全面接管目標同批閱
                </p>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3">
              {signupTrack === "coach" && (
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
                placeholder={signupTrack === "coach" ? "教練姓名" : "你的姓名"}
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
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="密碼（至少 6 位，散客必填）"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-xl border border-zinc-200 px-3 py-3"
              />

              {signupTrack === "solo" && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteField((v) => !v)}
                    className="text-xs text-zinc-500 underline"
                  >
                    {showInviteField ? "隱藏教練邀請碼" : "我有教練邀請碼（選填）"}
                  </button>
                  {showInviteField && (
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="請輸入教練專屬邀請碼 (若無教練請留空)"
                      className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm"
                    />
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-bold text-white disabled:opacity-60 ${
                  signupTrack === "coach" ? "bg-[#7ED321]" : "bg-[#7ED321]"
                } ${btnClass}`}
              >
                {loading
                  ? "註冊中..."
                  : signupTrack === "solo"
                    ? "🦍 立即註冊 AI 私教"
                    : "🚀 建立品牌空間"}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="text-center text-sm text-zinc-500 mt-5">
        Gym 老闆？{" "}
        <Link href="/sas-register" className="text-[#5fa718] font-semibold underline">
          免費開通品牌空間
        </Link>
      </p>

      <IosPwaInstallBanner />
    </div>
  );
}
