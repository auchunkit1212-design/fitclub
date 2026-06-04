"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { getSession } from "@/lib/session";
import { resolveIsPro } from "@/lib/user-plan";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

/** 僅 Pro 會員可見內容；日後 Pro 功能可包在此元件內 */
export function ProFeatureGate({ children, fallback }: Props) {
  const { t } = useI18n();
  const session = getSession();
  const isPro =
    session &&
    resolveIsPro({
      email: session.email,
      role: session.role,
      plan: session.plan,
      isPro: session.isPro,
    });

  if (isPro) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {t("profile.proOnly", "此功能僅供 Pro 會員使用。")}
    </p>
  );
}
