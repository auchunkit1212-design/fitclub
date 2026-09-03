"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ProCheckoutButton } from "@/components/ProCheckoutButton";
import { useI18n } from "@/components/I18nProvider";

export default function BillingCancelPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto pb-12">
      <PageHeader
        title={t("billing.cancelTitle", "未完成付款")}
        onBack={() => router.back()}
      />
      <main className="px-4 py-8 space-y-4">
        <p className="text-sm text-zinc-600 leading-relaxed">
          {t(
            "billing.cancelBody",
            "你已取消 Stripe Checkout。隨時可以再升級 Pro。"
          )}
        </p>
        <ProCheckoutButton />
      </main>
    </div>
  );
}
