"use client";

import { LoadingView } from "@/components/LoadingView";

export function AppLoadingScreen({
  logoUrl,
  message,
}: {
  logoUrl?: string;
  message?: string;
}) {
  return <LoadingView variant="fullscreen" logoUrl={logoUrl} message={message} />;
}
