"use client";

import { useI18n } from "@/components/I18nProvider";

export function FreeTrialBadge({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 ${className}`}
    >
      {t("billing.freeTrialBadge", "首 3 日免費試用")}
    </span>
  );
}
