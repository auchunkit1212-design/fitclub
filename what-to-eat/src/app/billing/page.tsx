"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Soft landing that redirects to main-app billing (shared Pro). */
export default function BillingPage() {
  const router = useRouter();
  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_MAIN_APP_BILLING_URL ||
      "http://localhost:3000/billing";
    window.location.href = url;
  }, [router]);
  return (
    <p className="animate-plan-pulse text-ink-muted">Redirecting to billing…</p>
  );
}
