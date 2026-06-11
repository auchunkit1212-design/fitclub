"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";

interface RegisterLegalConsentProps {
  className?: string;
}

export function RegisterLegalConsent({ className = "" }: RegisterLegalConsentProps) {
  const { t } = useI18n();

  return (
    <p className={`text-center text-[11px] text-zinc-500 leading-relaxed ${className}`}>
      {t(
        "legal.registerConsent",
        "註冊或登入即表示你同意"
      )}{" "}
      <Link href="/terms" className="text-emerald-700 underline font-medium">
        {t("legal.terms", "使用條款")}
      </Link>
      {t("legal.and", "同")}
      <Link href="/privacy" className="text-emerald-700 underline font-medium">
        {t("legal.privacy", "私隱政策")}
      </Link>
      。
    </p>
  );
}
