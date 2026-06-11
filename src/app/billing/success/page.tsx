"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/components/I18nProvider";
import { syncSessionPlan } from "@/lib/plan-client";

export default function BillingSuccessPage() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    let timer: number | undefined;
    void syncSessionPlan().finally(() => {
      timer = window.setTimeout(() => router.replace("/"), 2500);
    });
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto">
      <PageHeader
        title={t("billing.successTitle", "訂閱成功")}
        onBack={() => router.push("/")}
      />
      <main className="px-4 py-8 space-y-3 text-center">
        <p className="text-lg font-semibold text-emerald-700">
          {t("billing.successHeadline", "歡迎加入 Pro！")}
        </p>
        <p className="text-sm text-zinc-600 leading-relaxed">
          {t(
            "billing.successBody",
            "付款已完成，Pro 功能已解鎖。正在返回主頁..."
          )}
        </p>
      </main>
    </div>
  );
}
