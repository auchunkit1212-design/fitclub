"use client";

import { useI18n } from "@/components/I18nProvider";
import type { AppLanguage } from "@/lib/i18n";

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { lang, setLang, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-xs">
      <span className={dark ? "text-white/80" : "text-zinc-500"}>
        {t("language.label", "Language")}
      </span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as AppLanguage)}
        className={`rounded-lg border px-2 py-1 text-xs ${
          dark
            ? "bg-white/10 text-white border-white/20"
            : "bg-white text-zinc-700 border-zinc-200"
        }`}
      >
        <option value="zh-HK">{t("language.hk", "🇭🇰 廣東話")}</option>
        <option value="zh-TW">{t("language.tw", "🇹🇼 繁體中文 (台灣)")}</option>
        <option value="en">{t("language.en", "🇺🇸 English")}</option>
      </select>
    </label>
  );
}
