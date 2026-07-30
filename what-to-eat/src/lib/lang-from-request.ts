import {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  type AppLanguage,
} from "@/lib/i18n";

export function getStoredLanguageHint(request: Request): AppLanguage {
  const header = request.headers.get("x-wte-lang");
  if (header) return normalizeLanguage(header);
  const accept = request.headers.get("accept-language");
  if (accept) return normalizeLanguage(accept.split(",")[0]);
  return DEFAULT_LANGUAGE;
}
