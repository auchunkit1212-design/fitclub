"use client";

import { themeColorToHex } from "@/lib/brand";
import type { ThemeColor } from "@/lib/types";

interface GorillaMascotProps {
  themeColor?: ThemeColor;
  logoUrl?: string;
  className?: string;
}

export function GorillaMascot({
  themeColor = "emerald",
  logoUrl,
  className = "",
}: GorillaMascotProps) {
  const vestColor = themeColorToHex(themeColor);

  return (
    <div className={`relative w-28 h-32 shrink-0 ${className}`}>
      <img
        src="/gorilla.png"
        alt="Nutrition Coach 吉祥物"
        className="absolute inset-0 w-full h-full object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/gorilla.svg";
        }}
      />
      {/* 白背心動態換色 */}
      <div
        className="absolute left-[22%] top-[52%] w-[56%] h-[30%] rounded-lg mix-blend-multiply opacity-85 pointer-events-none"
        style={{ backgroundColor: vestColor }}
        aria-hidden
      />
      {logoUrl ? (
        <div className="absolute left-[30%] top-[56%] w-[40%] h-[18%] flex items-center justify-center pointer-events-none">
          <img
            src={logoUrl}
            alt=""
            className="max-w-full max-h-full object-contain rounded drop-shadow"
          />
        </div>
      ) : null}
    </div>
  );
}
