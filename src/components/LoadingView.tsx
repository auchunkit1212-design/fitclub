"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { useBranding } from "@/components/BrandingProvider";
import { GorillaMascot } from "@/components/GorillaMascot";
import {
  readLastBrand,
  resolveDisplayBrandLogo,
} from "@/lib/brand-logo";
import { getSession } from "@/lib/session";

type LoadingViewProps = {
  message?: string;
  variant?: "fullscreen" | "section" | "inline";
  logoUrl?: string;
  className?: string;
  children?: ReactNode;
};

function LoadingDots({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-1.5 ${className}`}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-emerald-500 animate-loading-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

export function LoadingView({
  message,
  variant = "fullscreen",
  logoUrl,
  className = "",
  children,
}: LoadingViewProps) {
  const brand = useBranding();
  const [storedLogo, setStoredLogo] = useState<string | undefined>();
  const [storedName, setStoredName] = useState<string | undefined>();

  useLayoutEffect(() => {
    if (logoUrl || brand.logo) {
      setStoredLogo(undefined);
      setStoredName(undefined);
      return;
    }
    const session = getSession();
    setStoredLogo(
      resolveDisplayBrandLogo(session) ?? readLastBrand()?.logo
    );
    setStoredName(
      session?.brandName ?? session?.gym ?? readLastBrand()?.gymName
    );
  }, [brand.logo, logoUrl]);

  const resolvedLogo = logoUrl || brand.logo || storedLogo;
  const gymName = brand.logo ? brand.gymName : storedName;

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex items-center gap-2 text-zinc-500 text-sm ${className}`}
        role="status"
        aria-live="polite"
      >
        <LoadingDots />
        {message ? <span>{message}</span> : null}
      </span>
    );
  }

  const shellClass =
    variant === "fullscreen"
      ? "min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center bg-white"
      : "flex flex-col items-center justify-center gap-4 py-12 px-6 text-center w-full";

  return (
    <div
      className={`${shellClass} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex flex-col items-center gap-4">
        <div
          className="absolute -inset-6 rounded-full bg-emerald-200/40 blur-2xl animate-loading-glow"
          aria-hidden
        />
        <div className="relative animate-gorilla-bounce">
          <GorillaMascot size="xl" logoUrl={resolvedLogo} />
        </div>
        <div className="relative w-28 h-1 rounded-full bg-emerald-100 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-emerald-500 animate-loading-bar" />
        </div>
      </div>

      <div className="space-y-2 max-w-xs">
        {resolvedLogo && gymName ? (
          <p className="text-sm font-semibold text-gray-900">{gymName}</p>
        ) : null}
        <LoadingDots />
        {message ? (
          <p className="text-sm text-zinc-500 leading-relaxed">{message}</p>
        ) : null}
      </div>

      {children}
    </div>
  );
}
