/** 上架／法律頁面共用設定（可經 env 覆寫） */
export const LEGAL_LAST_UPDATED = "2026-06-03";

export {
  DEFAULT_PUBLIC_SITE_URL,
  getAppUrl,
  getSiteUrl,
} from "@/lib/site-url";

export function getLegalContactEmail(): string {
  return (
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ||
    "auchunkit1212@gmail.com"
  );
}
