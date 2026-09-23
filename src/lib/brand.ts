import type { ThemeColor } from "@/lib/types";

/** Nutrition Coach — Coach! what to eat? */
export const BRAND_NAME = "Nutrition Coach";
export const BRAND_TAGLINE = "Coach! what to eat?";
export const BRAND_FULL = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

/** 官方 App logo（public/） */
export const APP_LOGO_PATH = "/gorilla-logo.png";

export type ThemePalette = {
  id: ThemeColor;
  label: string;
  hex: string;
  hover: string;
  dark: string;
  light: string;
};

export const THEME_PALETTE: ThemePalette[] = [
  { id: "emerald", label: "翠綠", hex: "#059669", hover: "#047857", dark: "#065f46", light: "#ecfdf5" },
  { id: "blue", label: "藍色", hex: "#2563eb", hover: "#1d4ed8", dark: "#1e3a8a", light: "#eff6ff" },
  { id: "sky", label: "天藍", hex: "#0284c7", hover: "#0369a1", dark: "#0c4a6e", light: "#f0f9ff" },
  { id: "violet", label: "紫色", hex: "#7c3aed", hover: "#6d28d9", dark: "#4c1d95", light: "#f5f3ff" },
  { id: "rose", label: "玫紅", hex: "#e11d48", hover: "#be123c", dark: "#881337", light: "#fff1f2" },
  { id: "orange", label: "橙色", hex: "#ea580c", hover: "#c2410c", dark: "#9a3412", light: "#fff7ed" },
  { id: "amber", label: "琥珀", hex: "#d97706", hover: "#b45309", dark: "#92400e", light: "#fffbeb" },
  { id: "black", label: "黑色", hex: "#18181b", hover: "#09090b", dark: "#09090b", light: "#f4f4f5" },
];

const THEME_IDS = new Set<string>(THEME_PALETTE.map((item) => item.id));

export function normalizeThemeColor(value?: string | null): ThemeColor {
  if (value && THEME_IDS.has(value)) return value as ThemeColor;
  return "emerald";
}

export function themePalette(theme?: string | null): ThemePalette {
  const id = normalizeThemeColor(theme);
  return THEME_PALETTE.find((item) => item.id === id) ?? THEME_PALETTE[0];
}

export function themeColorToHex(theme?: string | null): string {
  return themePalette(theme).hex;
}

/** 把主題寫入 :root，按鈕／底欄用 CSS 變數跟住變色。 */
export function applyDocumentTheme(theme?: string | null): void {
  if (typeof document === "undefined") return;
  const palette = themePalette(theme);
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", palette.hex);
  root.style.setProperty("--brand-primary-hover", palette.hover);
  root.style.setProperty("--brand-primary-dark", palette.dark);
  root.style.setProperty("--brand-primary-light", palette.light);
  root.style.setProperty("--brand-lime", palette.hex);
  root.style.setProperty("--brand-lime-hover", palette.hover);
  root.style.setProperty("--brand-lime-muted", palette.light);
  root.dataset.theme = palette.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", palette.hex);
}

/** 只在使用者上傳的自訂 logo 時才取代官方大猩猩（排除官方 gorilla logo） */
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

/** 解析可直接取代官方大猩猩嘅商戶／教練 logo（唔再疊喺背心） */
export function resolveTenantLogoUrl(logoUrl?: string): string | undefined {
  return isCustomBrandLogo(logoUrl) ? logoUrl : undefined;
}
