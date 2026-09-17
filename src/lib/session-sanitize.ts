import type { UserSession } from "@/lib/types";

const MAX_BRAND_LOGO_LEN = 512;

/** Keep only short HTTP(S) logo URLs in session payloads — never inline base64. */
export function safeBrandLogo(logo?: string | null): string | undefined {
  if (!logo?.trim()) return undefined;
  const trimmed = logo.trim();
  if (trimmed.startsWith("data:")) return undefined;
  if (trimmed.length > MAX_BRAND_LOGO_LEN) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeSessionForApi(session: UserSession): UserSession {
  return {
    ...session,
    brandLogo: safeBrandLogo(session.brandLogo),
  };
}
