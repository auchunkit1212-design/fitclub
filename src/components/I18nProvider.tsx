"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  t as translate,
  type AppLanguage,
} from "@/lib/i18n";

type I18nContextValue = {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  lang: DEFAULT_LANGUAGE,
  setLang: () => undefined,
  t: (key: string, fallback?: string) => fallback ?? key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const fromStorage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const fromCookie =
      document.cookie.match(/(?:^|; )app_lang=([^;]*)/)?.[1] ?? null;
    const initial = normalizeLanguage(
      fromStorage || (fromCookie ? decodeURIComponent(fromCookie) : navigator.language)
    );
    setLang(initial);
  }, []);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    document.cookie = `app_lang=${encodeURIComponent(lang)};path=/;max-age=31536000;SameSite=Lax`;
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string, fallback?: string, vars?: Record<string, string | number>) =>
        translate(lang, key, fallback, vars),
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
