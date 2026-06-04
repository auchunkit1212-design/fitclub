"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { RegisterInvitePrefill } from "@/components/RegisterInvitePrefill";
import { useRouter } from "next/navigation";
import { GorillaMascot } from "@/components/GorillaMascot";
import {
  Building2,
  Cpu,
  IconLabel,
  Rocket,
  Ticket,
} from "@/components/icons";
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
  const { t } = useI18n();
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
      return t("auth.welcome.login", "歡迎回來！登入後繼續記錄飲食同 AI 分析。");
    }
    if (signupTrack === "solo") {
      return t("auth.welcome.solo", "無教練都可加入 — 大猩猩 AI 私教會幫你設定目標同批閱每一餐。");
    }
    return t("auth.welcome.coach", "開通你的 Gym 品牌空間，開始管理學員飲食。");
  }, [authTab, signupTrack, t]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const applyInviteFromUrl = useCallback((code: string) => {
    setInviteCode(code);
    setShowInviteField(true);
    setSignupTrack("solo");
    setAuthTab("signup");
  }, []);

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
      finishSession(createAdminSession(normalized), "歡迎 最高總裁");
      return true;
    }

    try {
      const user = await fetchUserByEmail(normalized);
      if (user && !user.hasPassword) {
        const session = await buildSessionFromRegistryUser(user);
        finishSession(session, `歡迎 ${session.name}`);
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
      finishSession(session, `歡迎 ${demo.name}`);
      return true;
    }

    return false;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (signupPassword.length < 6) {
      showToast(t("auth.errors.passwordMin", "請設定至少 6 位密碼。"));
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
            !isCoach && inviteCode.trim() ? inviteCode.trim() : undefined,
          soloStudent: !isCoach && !inviteCode.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        session?: UserSession;
        gymName?: string;
      };

      if (!res.ok || !data.session) {
        showToast(data.error ?? t("auth.errors.registerFailed", "註冊失敗"));
        return;
      }

      await syncSupabaseAuthOnRegister(email.trim().toLowerCase(), signupPassword);
      finishSession(
        data.session,
        isCoach
          ? t("auth.toast.brandOpened", "品牌「{gymName}」已開通！", { gymName: data.gymName ?? gymName })
          : t("auth.toast.soloReady", "歡迎！AI 大猩猩私教已為你準備好 onboarding。")
      );
    } catch (err) {
      console.error("Register failed:", err);
      showToast(t("auth.errors.network", "連線失敗，請稍後再試。"));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setLoginError(t("auth.errors.emailRequired", "請先輸入 Email。"));
      showToast(t("auth.errors.emailRequired", "請先輸入 Email。"));
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
        finishSession(data.session, t("auth.toast.welcome", "歡迎 {name}", { name: data.session.name }));
        return;
      }

      const apiError = data.error ?? t("auth.errors.loginFailed", "登入失敗");
      console.error("Login failed:", apiError);

      if (await tryLegacyPasswordlessLogin(normalized)) {
        return;
      }

      setLoginError(apiError);
      showToast(apiError);
    } catch (err) {
      const message = err instanceof Error ? err.message : "連線失敗";
      console.error("Login failed:", message, err);

      if (await tryLegacyPasswordlessLogin(normalized)) {
        return;
      }

      setLoginError(message);
      showToast(t("auth.errors.networkRetry", "連線失敗，請檢查網絡後再試。"));
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

      <Suspense fallback={null}>
        <RegisterInvitePrefill onPrefill={applyInviteFromUrl} />
      </Suspense>

      <div className="text-center mb-5">
        <div className="flex justify-center mb-3">
          <GorillaMascot size="lg" />
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
              ["login", t("auth.tab.login", "登入 Login")],
              ["signup", t("auth.tab.signup", "註冊 Sign Up")],
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

        {inviteCode.trim() && authTab === "signup" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-900 text-center leading-relaxed">
            <IconLabel icon={Ticket} size="sm" iconClassName="text-amber-800">
              {t(
                "auth.invite.prefilled",
                "教練邀請已套用 · 邀請碼：{code}",
                { code: inviteCode.trim() }
              )}
            </IconLabel>
          </div>
        )}

        {authTab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.placeholder.email", "Email")}
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
              placeholder={t("auth.placeholder.password", "密碼（舊學員若未設定可留空）")}
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
              className={`w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-60 ${btnClass}`}
            >
              {loading ? t("auth.verifying", "驗證緊...") : t("auth.login", "登入")}
            </button>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSignupTrack("solo");
                  if (!inviteCode.trim()) setShowInviteField(false);
                }}
                className={`py-2 rounded-xl text-xs font-bold border-2 ${btnClass} ${
                  signupTrack === "solo"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-zinc-200 text-zinc-600"
                }`}
              >
                <IconLabel icon={Cpu} size="sm" iconClassName={signupTrack === "solo" ? "text-emerald-700" : "text-zinc-500"}>
                  {t("auth.signup.trackSolo", "AI 私教散客")}
                </IconLabel>
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
                <IconLabel icon={Building2} size="sm" iconClassName={signupTrack === "coach" ? "text-indigo-700" : "text-zinc-500"}>
                  {t("auth.signup.trackCoach", "教練 / 品牌")}
                </IconLabel>
              </button>
            </div>

            {signupTrack === "solo" && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                <p className="text-sm font-bold text-emerald-900">
                  {t("auth.signup.soloTitle", "註冊 AI 專屬私教（無須教練）")}
                </p>
                <p className="text-[11px] text-emerald-800/80 mt-0.5">
                  {t("auth.signup.soloHint", "密碼必填 · 自動接入官方 AI Tenant · 大猩猩全面接管目標同批閱")}
                </p>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3">
              {signupTrack === "coach" && (
                <input
                  value={gymName}
                  onChange={(e) => setGymName(e.target.value)}
                  placeholder={t("auth.placeholder.gymName", "Gym 品牌名稱（例如 Oxygym）")}
                  required
                  className="w-full rounded-xl border border-zinc-200 px-3 py-3"
                />
              )}

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={signupTrack === "coach" ? t("auth.signup.nameCoach", "教練姓名") : t("auth.signup.nameStudent", "你的姓名")}
                required
                className="w-full rounded-xl border border-zinc-200 px-3 py-3"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.placeholder.email", "Email")}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-200 px-3 py-3"
              />

              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder={t("auth.signup.passwordPlaceholder", "密碼（至少 6 位，散客必填）")}
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
                    {showInviteField ? t("auth.invite.hide", "隱藏教練邀請碼") : t("auth.invite.show", "我有教練邀請碼（選填）")}
                  </button>
                  {showInviteField && (
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder={t("auth.invite.placeholder", "請輸入教練專屬邀請碼 (若無教練請留空)")}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm"
                    />
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-bold text-white disabled:opacity-60 ${
                  signupTrack === "coach" ? "bg-emerald-600" : "bg-emerald-600"
                } ${btnClass}`}
              >
                {loading ? (
                  t("auth.signup.registering", "註冊中...")
                ) : signupTrack === "solo" ? (
                  <IconLabel icon={Cpu} size="md" className="justify-center" iconClassName="text-white">
                    {t("auth.signup.soloCta", "立即註冊 AI 私教")}
                  </IconLabel>
                ) : (
                  <IconLabel icon={Rocket} size="md" className="justify-center" iconClassName="text-white">
                    {t("auth.signup.coachCta", "建立品牌空間")}
                  </IconLabel>
                )}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="text-center text-sm text-zinc-500 mt-5">
        {t("auth.footer.ownerPrompt", "Gym 老闆？")}{" "}
        <Link href="/sas-register" className="text-emerald-700 font-semibold underline">
          {t("auth.footer.sasLink", "免費開通品牌空間")}
        </Link>
      </p>

      <IosPwaInstallBanner />
    </div>
  );
}
