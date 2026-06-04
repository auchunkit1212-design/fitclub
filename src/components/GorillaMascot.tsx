"use client";

import { useId } from "react";
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

/** 官方吉祥物 + 可選商戶 Logo 印花（背心區域） */
export function GorillaMascot({
  logoUrl,
  className = "",
  size = "md",
}: GorillaMascotProps) {
  const uid = useId().replace(/:/g, "");
  const dim = SIZE_CLASS[size];
  const tenantLogo = resolveTenantLogoUrl(logoUrl);

  if (!tenantLogo) {
    return (
      <img
        src={APP_LOGO_PATH}
        alt="Nutrition Coach"
        className={`${dim} object-contain shrink-0 ${className}`}
      />
    );
  }

  const clipId = `singlet-clip-${uid}`;
  const maskId = `singlet-mask-${uid}`;

  return (
    <div className={`relative shrink-0 ${dim} ${className}`} aria-label="Gorilla mascot">
      <svg viewBox="0 0 128 128" className="w-full h-full drop-shadow-sm">
        <defs>
          <clipPath id={clipId}>
            <path d="M44 72 C48 66, 56 63, 64 63 C72 63, 80 66, 84 72 L82 92 C76 97, 52 97, 46 92 Z" />
          </clipPath>
          <mask id={maskId}>
            <rect x="0" y="0" width="128" height="128" fill="black" />
            <path
              d="M44 72 C48 66, 56 63, 64 63 C72 63, 80 66, 84 72 L82 92 C76 97, 52 97, 46 92 Z"
              fill="white"
            />
          </mask>
        </defs>

        <image
          href={APP_LOGO_PATH}
          x="0"
          y="0"
          width="128"
          height="128"
          preserveAspectRatio="xMidYMid meet"
        />

        <g clipPath={`url(#${clipId})`} mask={`url(#${maskId})`}>
          <image
            href={tenantLogo}
            x="43"
            y="62"
            width="42"
            height="32"
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
      </svg>
    </div>
  );
}
