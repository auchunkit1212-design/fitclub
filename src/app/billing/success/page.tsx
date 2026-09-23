"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/components/I18nProvider";
import { getSessionRequestHeaders } from "@/lib/session";
import { syncSessionPlan } from "@/lib/plan-client";

function BillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    let timer: number | undefined;

    void (async () => {
      const sessionId = searchParams.get("session_id");
      if (sessionId) {
        try {
          await fetch("/api/stripe/confirm-checkout", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...getSessionRequestHeaders(),
            },
            body: JSON.stringify({ sessionId }),
          });
        } catch {
          // webhook may still sync later
        }
      }
      await syncSessionPlan();
      timer = window.setTimeout(() => router.replace("/settings"), 2500);
    })();

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto">
      <PageHeader
        title={t("billing.successTitle", "訂閱成功")}
        onBack={() => router.push("/settings")}
      />
      <main className="px-4 py-8 space-y-3 text-center">
        <p className="text-lg font-semibold text-emerald-700">
          {t("billing.successHeadline", "歡迎加入 Pro！")}
        </p>
        <p className="text-sm text-zinc-600 leading-relaxed">
          {t(
            "billing.successBody",
            "付款已完成，Pro 功能已解鎖。正在返回設定頁..."
          )}
        </p>
      </main>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
          Loading…
        </div>
      }
    >
      <BillingSuccessContent />
    </Suspense>
  );
}
