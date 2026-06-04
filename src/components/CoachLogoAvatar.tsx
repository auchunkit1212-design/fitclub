"use client";

import { resolveCoachBrandLogo } from "@/lib/brand";

const SIZE = {
  sm: "w-14 h-14",
  story: "w-[3.75rem] h-[3.75rem]",
} as const;

interface CoachLogoAvatarProps {
  logoUrl?: string;
  label?: string;
  size?: keyof typeof SIZE;
  className?: string;
}

/** Story 環 / 頭像：只顯示教練 logo，唔用大猩猩 */
export function CoachLogoAvatar({
  logoUrl,
  label = "Coach",
  size = "story",
  className = "",
}: CoachLogoAvatarProps) {
  const src = resolveCoachBrandLogo(logoUrl);
  const dim = SIZE[size];
  const initial = (label.trim()[0] ?? "?").toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={`${dim} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center shrink-0 ${className}`}
      aria-label={label}
    >
      <span className="text-lg">{initial}</span>
    </div>
  );
}
