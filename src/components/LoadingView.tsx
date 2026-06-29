"use client";

import type { ReactNode } from "react";
import { GorillaMascot } from "@/components/GorillaMascot";

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
      ? "min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center"
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
          <GorillaMascot size="lg" logoUrl={logoUrl} />
        </div>
        <div className="relative w-28 h-1 rounded-full bg-emerald-100 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-emerald-500 animate-loading-bar" />
        </div>
      </div>

      <div className="space-y-2 max-w-xs">
        <LoadingDots />
        {message ? (
          <p className="text-sm text-zinc-500 leading-relaxed">{message}</p>
        ) : null}
      </div>

      {children}
    </div>
  );
}
