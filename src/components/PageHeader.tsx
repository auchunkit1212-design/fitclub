"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  subtitle?: string;
  variant?: "light" | "dark";
  sticky?: boolean;
}

export function PageHeader({
  title,
  onBack,
  backLabel = "← 返回",
  subtitle,
  variant = "light",
  sticky = true,
}: PageHeaderProps) {
  const { t } = useI18n();
  const computedBackLabel = backLabel === "← 返回" ? t("header.back", "← 返回") : backLabel;

  return (
    <header
      className={`px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] ${
        sticky ? "sticky top-0 z-20" : ""
      } bg-white text-gray-900 border-b border-gray-200 shadow-sm`}
    >
      <div className="flex items-center gap-3 min-h-[44px]">
        <button
          type="button"
          onClick={onBack}
          className={`shrink-0 text-sm font-medium px-3 py-2.5 rounded-lg min-h-[44px] ${btnClass} text-gray-700 bg-gray-100`}
        >
          {computedBackLabel}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold truncate text-lg text-gray-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm mt-0.5 truncate text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
