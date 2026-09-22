"use client";

import type { ReactNode } from "react";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { GorillaMascot } from "@/components/GorillaMascot";
import { BottomNav } from "@/components/BottomNav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Hand, IconLabel, MapPin } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { BRAND_TAGLINE } from "@/lib/brand";
import type { UserSession } from "@/lib/types";

export const HOME_BTN_CLASS =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";
export const HOME_SOFT_CARD =
  "w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]";
export const HOME_BRAND_BTN = "bg-emerald-600 hover:bg-emerald-700 text-white";

export function HomeChunkFallback() {
  return <AppLoadingScreen />;
}

export function HomeShell({
  session,
  brandingLogo,
  title,
  displayName,
  homeLabel,
  onRefresh,
  onLogout,
  toast,
  headerActions,
  extraHeader,
  welcomeExtra,
  onFabClick,
  showWelcome = true,
  children,
}: {
  session: UserSession;
  brandingLogo?: string;
  title: string;
  displayName: string;
  homeLabel: string;
  onRefresh?: () => void | Promise<void>;
  onLogout: () => void;
  toast?: string;
  headerActions?: ReactNode;
  extraHeader?: ReactNode;
  welcomeExtra?: ReactNode;
  onFabClick?: () => void;
  showWelcome?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const roleLabel =
    session.role === "admin"
      ? t("roles.admin", "總控制台")
      : session.role === "coach"
        ? t("roles.coach", "教練")
        : t("roles.student", "學員");

  return (
    <PullToRefresh
      onRefresh={onRefresh ?? (async () => undefined)}
      disabled={!onRefresh}
    >
      <div className="min-h-screen bg-white pb-32">
        {toast ? (
          <div className="fixed inset-x-0 top-safe z-50 px-4 pointer-events-none">
            <div className="mx-auto w-full max-w-md pointer-events-auto">
              <div className="bg-white text-gray-900 px-4 py-3 rounded-2xl text-sm font-semibold text-center shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                {toast}
              </div>
            </div>
          </div>
        ) : null}

        <div className="w-full max-w-md mx-auto px-4 py-6 pt-safe flex flex-col gap-5 bg-white min-h-screen">
          <header className="w-full space-y-4">
            <div className="flex items-start justify-between gap-3 w-full">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <GorillaMascot logoUrl={brandingLogo} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-500 text-xs leading-tight">
                    {BRAND_TAGLINE}
                  </p>
                  <h1 className="text-xl font-bold text-gray-900 leading-tight mt-0.5 truncate">
                    {displayName}
                  </h1>
                  <p className="text-gray-500 text-sm mt-0.5 truncate">
                    {session.gym} · {t("home.healthMgmt", "健康管理")}
                  </p>
                  {title ? (
                    <p className="text-emerald-600 text-xs font-semibold mt-1 truncate">
                      {title}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {headerActions}
                <button
                  type="button"
                  onClick={onLogout}
                  className={`text-[10px] bg-gray-100 text-gray-500 px-2.5 py-1.5 rounded-xl whitespace-nowrap ${HOME_BTN_CLASS}`}
                >
                  {t("header.logout", "登出")}
                </button>
              </div>
            </div>

            {extraHeader}

            <div className="w-full flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500">{homeLabel}</p>
              <LanguageSwitcher />
            </div>
          </header>

          <main className="flex flex-col gap-5 w-full">
            {showWelcome ? (
            <section className={`${HOME_SOFT_CARD} p-5 text-sm`}>
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 text-base min-w-0">
                  <IconLabel icon={Hand} iconClassName="text-gray-600">
                    {t("home.welcome", "歡迎，{name}", { name: displayName })}
                  </IconLabel>
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {welcomeExtra}
                  <span
                    className={`text-[10px] font-bold uppercase ${HOME_BRAND_BTN} px-2.5 py-1 rounded-full`}
                  >
                    {roleLabel}
                  </span>
                </div>
              </div>
              <p className="text-gray-500 mt-2 text-xs">{session.email}</p>
              <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1.5">
                <MapPin
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-gray-500"
                  aria-hidden
                />
                {session.gym}
              </p>
            </section>
            ) : null}
            {children}
          </main>
        </div>

        <BottomNav role={session.role} onFabClick={onFabClick} />
      </div>
    </PullToRefresh>
  );
}
