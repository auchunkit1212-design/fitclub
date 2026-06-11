"use client";

import type { ReactNode } from "react";
import { ProUpgradePrompt } from "@/components/ProUpgradePrompt";
import { hasProAccessFromSession } from "@/lib/plan-access";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  feature?: string;
};

/** Pro 會員內容；學員可透過個人 Pro 或 Pro 教練繼承 */
export function ProFeatureGate({ children, fallback, feature }: Props) {
  const isPro = hasProAccessFromSession();

  if (isPro) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  return <ProUpgradePrompt feature={feature} />;
}
