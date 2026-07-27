"use client";

import { APP_LOGO_PATH, resolveTenantLogoUrl } from "@/lib/brand";

interface GorillaMascotProps {
  logoUrl?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** @deprecated */
  themeColor?: string;
  /** @deprecated */
  tenantSlug?: string;
}

const SIZE_CLASS = {
  sm: "w-16 h-16",
  md: "w-20 h-20",
  lg: "w-36 h-36",
  xl: "w-44 h-44",
} as const;

const PAD_CLASS = {
  sm: "p-1.5",
  md: "p-2",
  lg: "p-3",
  xl: "p-3.5",
} as const;

/**
 * Brand mark for header / loading / AI cards.
 * Custom coach logo fully replaces the default gorilla inside a circular frame.
 */
export function GorillaMascot({
  logoUrl,
  className = "",
  size = "md",
}: GorillaMascotProps) {
  const dim = SIZE_CLASS[size];
  const pad = PAD_CLASS[size];
  const tenantLogo = resolveTenantLogoUrl(logoUrl);
  const src = tenantLogo ?? APP_LOGO_PATH;
  const alt = tenantLogo ? "Brand logo" : "Nutrition Coach";

  return (
    <div
      className={`${dim} shrink-0 rounded-full bg-white ring-2 ring-emerald-100 shadow-[0_8px_24px_rgb(0,0,0,0.08)] overflow-hidden flex items-center justify-center ${pad} ${className}`}
      aria-label={alt}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full ${
          tenantLogo ? "object-cover rounded-full" : "object-contain"
        }`}
      />
    </div>
  );
}
