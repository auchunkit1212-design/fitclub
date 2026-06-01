"use client";

import { useId } from "react";
import { resolveTenantLogoUrl } from "@/lib/brand";

interface GorillaMascotProps {
  logoUrl?: string;
  className?: string;
  size?: "sm" | "md";
  /** @deprecated */
  themeColor?: string;
  /** @deprecated */
  tenantSlug?: string;
}

/** 新版吉祥物：以 clipPath 把商戶 Logo 印在背心區域 */
export function GorillaMascot({
  logoUrl,
  className = "",
  size = "md",
}: GorillaMascotProps) {
  const uid = useId().replace(/:/g, "");
  const dim = size === "sm" ? "w-14 h-14" : "w-[4.5rem] h-[4.5rem]";
  const tenantLogo = resolveTenantLogoUrl(logoUrl);
  const showTenantLogo = Boolean(tenantLogo);
  const clipId = `singlet-clip-${uid}`;
  const maskId = `singlet-mask-${uid}`;

  return (
    <div className={`relative shrink-0 ${dim} ${className}`} aria-label="Gorilla mascot">
      <svg viewBox="0 0 128 128" className="w-full h-full drop-shadow-sm">
        <defs>
          <clipPath id={clipId}>
            {/* 背心區域：可按新版 SVG 再微調 path */}
            <path d="M42 66 C47 60, 56 57, 64 57 C72 57, 81 60, 86 66 L83 93 C76 98, 52 98, 45 93 Z" />
          </clipPath>
          <mask id={maskId}>
            <rect x="0" y="0" width="128" height="128" fill="black" />
            <path
              d="M42 66 C47 60, 56 57, 64 57 C72 57, 81 60, 86 66 L83 93 C76 98, 52 98, 45 93 Z"
              fill="white"
            />
          </mask>
        </defs>

        {/* 底圖：新吉祥物 SVG */}
        <image href="/new-gorilla.svg" x="0" y="0" width="128" height="128" preserveAspectRatio="xMidYMid meet" />

        {/* 背心底色：純白 */}
        <path
          d="M42 66 C47 60, 56 57, 64 57 C72 57, 81 60, 86 66 L83 93 C76 98, 52 98, 45 93 Z"
          fill="#FFFFFF"
          opacity="0.95"
        />

        {/* 商戶 Logo 以 clipPath 滿版印花 */}
        {showTenantLogo && tenantLogo ? (
          <g clipPath={`url(#${clipId})`} mask={`url(#${maskId})`}>
            <image
              href={tenantLogo}
              x="41"
              y="56"
              width="46"
              height="42"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
