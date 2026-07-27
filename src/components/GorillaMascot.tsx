"use client";

import { APP_LOGO_PATH, resolveTenantLogoUrl } from "@/lib/brand";

interface GorillaMascotProps {
  logoUrl?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** @deprecated */
  themeColor?: string;
  /** @deprecated */
  tenantSlug?: string;
}

const SIZE_CLASS = {
  sm: "w-14 h-14",
  md: "w-[4.5rem] h-[4.5rem]",
  lg: "w-28 h-28",
} as const;

/**
 * Brand mark for header / loading / AI cards.
 * Custom coach logo fully replaces the default gorilla — never stamped on the vest.
 */
export function GorillaMascot({
  logoUrl,
  className = "",
  size = "md",
}: GorillaMascotProps) {
  const dim = SIZE_CLASS[size];
  const tenantLogo = resolveTenantLogoUrl(logoUrl);
  const src = tenantLogo ?? APP_LOGO_PATH;
  const alt = tenantLogo ? "Brand logo" : "Nutrition Coach";

  return (
    <img
      src={src}
      alt={alt}
      className={`${dim} object-contain shrink-0 rounded-2xl ${className}`}
    />
  );
}
