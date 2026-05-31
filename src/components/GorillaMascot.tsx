"use client";

import Image from "next/image";
import { APP_LOGO_PATH, resolveTenantLogoUrl } from "@/lib/brand";

interface GorillaMascotProps {
  logoUrl?: string;
  className?: string;
  size?: "sm" | "md";
  /** @deprecated */
  themeColor?: string;
  /** @deprecated */
  tenantSlug?: string;
}

/** 官方大猩猩 PNG + 胸口白背心 + 商戶 Logo 徽章 */
export function GorillaMascot({
  logoUrl,
  className = "",
  size = "md",
}: GorillaMascotProps) {
  const dim = size === "sm" ? "w-14 h-14" : "w-[4.5rem] h-[4.5rem]";
  const tenantLogo = resolveTenantLogoUrl(logoUrl);
  const showTenantLogo = Boolean(tenantLogo);
  const singletClass =
    size === "sm"
      ? "w-[46%] h-[24%] top-[63%]"
      : "w-[44%] h-[22%] top-[62%]";

  return (
    <div className={`relative shrink-0 ${dim} ${className}`}>
      <Image
        src={APP_LOGO_PATH}
        alt="Nutrition Coach"
        width={512}
        height={512}
        className="w-full h-full object-contain drop-shadow-sm"
        priority
      />

      {/* 白背心畫布（疊在官方 logo 胸口位置） */}
      <div
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] ${singletClass}`}
        aria-hidden
      />

      {showTenantLogo && tenantLogo ? (
        <div className="pointer-events-none absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 z-10">
          <Image
            src={tenantLogo}
            alt=""
            width={40}
            height={40}
            unoptimized
            className={`${size === "sm" ? "w-7 h-7" : "w-9 h-9"} rounded-full object-cover border-2 border-white shadow-md`}
          />
        </div>
      ) : null}
    </div>
  );
}
