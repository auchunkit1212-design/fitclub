/** Nutrition Coach — Coach! what to eat? */
export const BRAND_NAME = "Nutrition Coach";
export const BRAND_TAGLINE = "Coach! what to eat?";
export const BRAND_FULL = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

export function themeColorToHex(theme: "emerald" | "blue" | "black"): string {
  if (theme === "blue") return "#2563eb";
  if (theme === "black") return "#18181b";
  return "#059669";
}
