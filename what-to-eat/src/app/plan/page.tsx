"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Alias route — meal plan dashboard lives on `/`. */
export default function PlanAliasPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <p className="animate-plan-pulse text-ink-muted">載入餐單…</p>
  );
}
