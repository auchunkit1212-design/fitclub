"use client";

import { useI18n } from "@/components/I18nProvider";

type Props = {
  className?: string;
};

export function ProBadge({ className = "" }: Props) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ${className}`}
      title={t("profile.proMember", "Pro 會員")}
    >
      {t("profile.proBadge", "Pro")}
    </span>
  );
}
