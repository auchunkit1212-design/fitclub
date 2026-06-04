/** Nutrition Coach — Coach! what to eat? */
export const BRAND_NAME = "Nutrition Coach";
export const BRAND_TAGLINE = "Coach! what to eat?";
export const BRAND_FULL = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

/** 官方 App logo（public/） */
export const APP_LOGO_PATH = "/gorilla-logo.png";

export function themeColorToHex(theme: "emerald" | "blue" | "black"): string {
  if (theme === "blue") return "#2563eb";
  if (theme === "black") return "#18181b";
  return "#059669";
}

/** 只在使用者上傳的自訂 logo 時才疊加（排除官方 gorilla logo） */
export function isCustomBrandLogo(logo?: string): boolean {
  if (!logo?.trim()) return false;
  if (logo.includes("gorilla-logo.png")) return false;
  if (logo.includes("gorilla.svg")) return false;
  if (logo.includes("logo.png")) return false;
  return (
    logo.startsWith("data:") ||
    logo.startsWith("http") ||
    logo.startsWith("/api/tenant/logo")
  );
}

/** 教練 / 分店品牌 logo（排除官方大猩猩預設圖） */
export function resolveCoachBrandLogo(logoUrl?: string): string | undefined {
  if (!logoUrl?.trim()) return undefined;
  const lower = logoUrl.toLowerCase();
  if (lower.includes("gorilla-logo") || lower.includes("gorilla.svg")) {
    return undefined;
  }
  return logoUrl;
}

/** 解析可疊加在白背心上的 tenant logo */
export function resolveTenantLogoUrl(logoUrl?: string): string | undefined {
  return isCustomBrandLogo(logoUrl) ? logoUrl : undefined;
}
