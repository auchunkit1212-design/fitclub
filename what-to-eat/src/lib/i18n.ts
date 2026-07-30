import en from "@/messages/en.json";
import zhHK from "@/messages/zh-HK.json";
import zhTW from "@/messages/zh-TW.json";

export const SUPPORTED_LANGUAGES = ["zh-HK", "zh-TW", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "zh-HK";
export const LANGUAGE_STORAGE_KEY = "wte_app_language";

const messages: Record<AppLanguage, Record<string, unknown>> = {
  "zh-HK": zhHK as Record<string, unknown>,
  "zh-TW": zhTW as Record<string, unknown>,
  en: en as Record<string, unknown>,
};

export function isAppLanguage(
  value: string | null | undefined
): value is AppLanguage {
  return Boolean(value && SUPPORTED_LANGUAGES.includes(value as AppLanguage));
}

export function normalizeLanguage(
  value: string | null | undefined
): AppLanguage {
  if (isAppLanguage(value)) return value;
  const lower = (value ?? "").toLowerCase();
  if (lower.startsWith("zh-tw")) return "zh-TW";
  if (lower.startsWith("zh-hk") || lower.startsWith("zh-mo")) return "zh-HK";
  if (lower.startsWith("en")) return "en";
  return DEFAULT_LANGUAGE;
}

export function getLanguageInstruction(lang: AppLanguage): string {
  if (lang === "en") {
    return "Respond entirely in English for all meal titles and descriptions.";
  }
  if (lang === "zh-TW") {
    return "請嚴格使用台灣慣用語和繁體中文回覆所有餐名與說明。";
  }
  return "請使用香港地道廣東話和繁體中文回覆所有餐名與說明。";
}

export function t(
  lang: AppLanguage,
  key: string,
  fallback?: string,
  vars?: Record<string, string | number>
): string {
  const value = resolvePath(messages[lang], key);
  let text = typeof value === "string" ? value : fallback ?? key;
  if (vars) {
    for (const [name, val] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(val));
    }
  }
  return text;
}

function resolvePath(obj: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, obj);
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function setStoredLanguage(lang: AppLanguage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}
