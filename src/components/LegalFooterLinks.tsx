"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import type { LegalDocId } from "@/lib/legal-content";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface LegalFooterLinksProps {
  className?: string;
  hideCurrent?: LegalDocId;
  showDeleteAccount?: boolean;
}

export function LegalFooterLinks({
  className = "",
  hideCurrent,
  showDeleteAccount = true,
}: LegalFooterLinksProps) {
  const { t } = useI18n();

  const links: { href: string; label: string; id?: LegalDocId }[] = [
    {
      href: "/privacy",
      label: t("legal.privacy", "私隱政策"),
      id: "privacy",
    },
    {
      href: "/terms",
      label: t("legal.terms", "使用條款"),
      id: "terms",
    },
  ];

  if (showDeleteAccount) {
    links.push({
      href: "/delete-account",
      label: t("legal.deleteAccount", "刪除帳戶"),
    });
  }

  const visible = links.filter((l) => l.id !== hideCurrent);

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-zinc-500 ${className}`}
      aria-label={t("legal.footerNav", "法律與帳戶")}
    >
      {visible.map((link, i) => (
        <span key={link.href} className="inline-flex items-center gap-3">
          {i > 0 && <span aria-hidden className="text-zinc-300">·</span>}
          <Link
            href={link.href}
            className={`text-emerald-700 font-medium underline ${btnClass}`}
          >
            {link.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
