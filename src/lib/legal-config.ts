/** 上架／法律頁面共用設定（可經 env 覆寫） */
export const LEGAL_LAST_UPDATED = "2026-06-03";

export function getLegalContactEmail(): string {
  return (
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ||
    "auchunkit1212@gmail.com"
  );
}

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "https://fitclub.hk";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/** Stripe / 法律頁跳轉用；env 可只填網域，會自動補 https:// */
export function getSiteUrl(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return normalizeSiteUrl(fromEnv);
  if (fallbackOrigin) return normalizeSiteUrl(fallbackOrigin);
  return "https://fitclub.hk";
}
