"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  setStoredLanguage,
  t,
  type AppLanguage,
} from "@/lib/i18n";

type I18nCtx = {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  tt: (key: string, fallback?: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx>({
  lang: DEFAULT_LANGUAGE,
  setLang: () => {},
  tt: (key, fallback) => fallback ?? key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    setLangState(getStoredLanguage());
  }, []);

  const setLang = useCallback((next: AppLanguage) => {
    setStoredLanguage(next);
    setLangState(next);
  }, []);

  const tt = useCallback(
    (
      key: string,
      fallback?: string,
      vars?: Record<string, string | number>
    ) => t(lang, key, fallback, vars),
    [lang]
  );

  return (
    <Ctx.Provider value={{ lang, setLang, tt }}>{children}</Ctx.Provider>
  );
}

export function useI18n() {
  return useContext(Ctx);
}
