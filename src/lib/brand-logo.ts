import { isCustomBrandLogo } from "@/lib/brand";
import { safeBrandLogo } from "@/lib/session-sanitize";
import type { UserSession } from "@/lib/types";

export const LAST_BRAND_STORAGE_KEY = "fitclub:last-brand";
export const LAST_BRAND_COOKIE = "fitclub_brand";

export type LastBrandSnapshot = {
  gymName?: string;
  logo?: string;
  tenantSlug?: string;
};

export function tenantLogoProxyUrl(params: {
  slug?: string | null;
  email?: string | null;
}): string | undefined {
  const search = new URLSearchParams();
  const slug = params.slug?.trim();
  const email = params.email?.trim();
  if (slug) search.set("slug", slug);
  if (email) search.set("email", email);
  const query = search.toString();
  if (!query) return undefined;
  return `/api/tenant/logo?${query}`;
}

/** Turn a stored gym/coach logo into a short URL that can live in cookies/session. */
export function toPublicBrandLogoUrl(input: {
  logo?: string | null;
  tenantSlug?: string | null;
  email?: string | null;
}): string | undefined {
  const logo = input.logo?.trim() ?? "";
  if (!logo) return undefined;
  if (!isCustomBrandLogo(logo) && !logo.startsWith("data:")) {
    return undefined;
  }

  const safe = safeBrandLogo(logo);
  if (safe && /^https?:\/\//i.test(safe)) return safe;
  if (safe?.startsWith("/api/tenant/logo")) return safe;

  return tenantLogoProxyUrl({
    slug: input.tenantSlug,
    email: input.email,
  });
}

/** Best logo URL for loading / header from a session (including older stripped sessions). */
export function resolveDisplayBrandLogo(
  session?: Pick<UserSession, "brandLogo" | "tenantSlug" | "email"> | null
): string | undefined {
  if (!session) return undefined;

  const fromLogo = toPublicBrandLogoUrl({
    logo: session.brandLogo,
    tenantSlug: session.tenantSlug,
    email: session.email,
  });
  if (fromLogo) return fromLogo;

  // Older sessions dropped data: logos; the gym slug still finds the uploaded mark.
  return tenantLogoProxyUrl({
    slug: session.tenantSlug,
    email: session.brandLogo ? session.email : undefined,
  });
}

export function parseLastBrandJson(
  raw?: string | null
): LastBrandSnapshot | null {
  if (!raw?.trim()) return null;

  const attempts = [raw, safeDecode(raw)];
  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as LastBrandSnapshot;
      if (!parsed || typeof parsed !== "object") continue;
      return {
        gymName:
          typeof parsed.gymName === "string" ? parsed.gymName : undefined,
        logo: typeof parsed.logo === "string" ? parsed.logo : undefined,
        tenantSlug:
          typeof parsed.tenantSlug === "string" ? parsed.tenantSlug : undefined,
      };
    } catch {
      // try next
    }
  }
  return null;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function readLastBrand(): LastBrandSnapshot | null {
  if (typeof window === "undefined") return null;
  return parseLastBrandJson(localStorage.getItem(LAST_BRAND_STORAGE_KEY));
}

export function writeLastBrand(brand: LastBrandSnapshot): void {
  if (typeof window === "undefined") return;
  const snapshot: LastBrandSnapshot = {
    gymName: brand.gymName?.trim() || undefined,
    logo: brand.logo?.trim() || undefined,
    tenantSlug: brand.tenantSlug?.trim() || undefined,
  };
  if (!snapshot.gymName && !snapshot.logo && !snapshot.tenantSlug) return;

  try {
    localStorage.setItem(LAST_BRAND_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // quota / private mode
  }

  const secure = window.location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `${LAST_BRAND_COOKIE}=${encodeURIComponent(
    JSON.stringify(snapshot)
  )};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax${secure}`;
}
