"use client";

import Image from "next/image";
import { APP_LOGO_PATH, isCustomBrandLogo } from "@/lib/brand";

interface GorillaMascotProps {
  logoUrl?: string;
  className?: string;
  size?: "sm" | "md";
  /** @deprecated 官方 logo 為固定黑白大猩猩，不再跟 theme 變色 */
  themeColor?: string;
}

/** Nutrition Coach 官方大猩猩 logo */
export function GorillaMascot({
  logoUrl,
  className = "",
  size = "md",
}: GorillaMascotProps) {
  const dim = size === "sm" ? "w-14 h-14" : "w-[4.5rem] h-[4.5rem]";
  const showTenantLogo = isCustomBrandLogo(logoUrl);

  return (
    <div className={`relative shrink-0 ${dim} ${className}`}>
      <Image
        src={APP_LOGO_PATH}
        alt="Nutrition Coach"
        width={256}
        height={256}
        className="w-full h-full object-contain drop-shadow-sm"
        priority
      />
      {showTenantLogo && logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="absolute -bottom-0.5 -right-0.5 w-[28%] h-[28%] rounded-full border-2 border-white object-cover shadow-sm"
        />
      ) : null}
    </div>
  );
}
