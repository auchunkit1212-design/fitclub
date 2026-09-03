/** 目前可用嘅正式公開網址（fitclub.hk DNS 未設定時用呢個） */
export const DEFAULT_PUBLIC_SITE_URL = "https://fitclub-pearl.vercel.app";

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_PUBLIC_SITE_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/** Stripe / 法律頁 / Capacitor / OpenRouter Referer 用 */
export function getSiteUrl(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return normalizeSiteUrl(fromEnv);
  if (fallbackOrigin) return normalizeSiteUrl(fallbackOrigin);
  return DEFAULT_PUBLIC_SITE_URL;
}

/** OpenRouter HTTP-Referer 等同對外 App URL */
export function getAppUrl(): string {
  const fromEnv =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return normalizeSiteUrl(fromEnv);
  return DEFAULT_PUBLIC_SITE_URL;
}
