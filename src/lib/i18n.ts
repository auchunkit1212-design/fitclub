import en from "@/messages/en.json";
import zhHK from "@/messages/zh-HK.json";
import zhTW from "@/messages/zh-TW.json";

export const SUPPORTED_LANGUAGES = ["zh-HK", "zh-TW", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "zh-HK";
export const LANGUAGE_STORAGE_KEY = "app_language";

const messages: Record<AppLanguage, Record<string, unknown>> = {
  "zh-HK": zhHK as Record<string, unknown>,
  "zh-TW": zhTW as Record<string, unknown>,
  en: en as Record<string, unknown>,
};

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return Boolean(value && SUPPORTED_LANGUAGES.includes(value as AppLanguage));
}

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  if (isAppLanguage(value)) return value;
  const lower = (value ?? "").toLowerCase();
  if (lower.startsWith("zh-tw")) return "zh-TW";
  if (lower.startsWith("zh-hk") || lower.startsWith("zh-mo")) return "zh-HK";
  if (lower.startsWith("en")) return "en";
  return DEFAULT_LANGUAGE;
}

export function getLanguageInstruction(lang: AppLanguage): string {
  if (lang === "en") {
    return "You must respond entirely in English. The 'food_name' and any feedback must be in English.";
  }
  if (lang === "zh-TW") {
    return "請嚴格使用台灣慣用語（如：熱量、便當、公克）和繁體中文回覆。";
  }
  return "請使用香港地道廣東話（如：卡路里、飯盒、克）和繁體中文回覆。";
}

export function t(lang: AppLanguage, key: string, fallback?: string): string {
  const value = resolvePath(messages[lang], key);
  if (typeof value === "string") return value;
  return fallback ?? key;
}

function resolvePath(obj: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, obj);
}
