/** 上架／法律頁面共用設定（可經 env 覆寫） */
export const LEGAL_LAST_UPDATED = "2026-06-03";

export function getLegalContactEmail(): string {
  return (
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ||
    "auchunkit1212@gmail.com"
  );
}

export function getSiteUrl(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
  return "https://fitclub.hk";
}
