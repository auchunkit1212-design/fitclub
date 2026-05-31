/** Nutrition Coach — Coach! what to eat? */
export const BRAND_NAME = "Nutrition Coach";
export const BRAND_TAGLINE = "Coach! what to eat?";
export const BRAND_FULL = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

export function themeColorToHex(theme: "emerald" | "blue" | "black"): string {
  if (theme === "blue") return "#2563eb";
  if (theme === "black") return "#18181b";
  return "#059669";
}

/** 只在使用者上傳的自訂 logo 時才疊加在背心（排除預設 logo.png） */
export function isCustomBrandLogo(logo?: string): boolean {
  if (!logo?.trim()) return false;
  if (logo.includes("logo.png")) return false;
  return logo.startsWith("data:") || logo.startsWith("http");
}
