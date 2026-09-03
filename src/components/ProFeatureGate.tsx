"use client";

import type { ReactNode } from "react";
import { Lock } from "@/components/icons";
import { ProUpgradePrompt } from "@/components/ProUpgradePrompt";
import { useI18n } from "@/components/I18nProvider";
import { hasProAccessFromSession } from "@/lib/plan-access";
import { ProLockedProvider } from "@/lib/pro-locked-context";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  feature?: string;
};

/** Pro 會員內容；非 Pro 時顯示功能預覽並封鎖操作 */
export function ProFeatureGate({ children, fallback, feature }: Props) {
  const { t } = useI18n();
  const isPro = hasProAccessFromSession();

  if (isPro) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <ProLockedProvider locked>
      <div className="space-y-3">
        <div className="relative rounded-3xl overflow-hidden ring-1 ring-amber-200/50">
          <div className="pointer-events-none select-none">
            {children}
          </div>
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-amber-100/95 border border-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 shadow-sm">
            <Lock size={11} strokeWidth={2.5} aria-hidden />
            {t("profile.proPreviewBadge", "預覽")}
          </div>
        </div>
        <ProUpgradePrompt feature={feature} />
      </div>
    </ProLockedProvider>
  );
}
