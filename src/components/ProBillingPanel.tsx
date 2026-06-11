"use client";

import { useI18n } from "@/components/I18nProvider";
import { Sparkles, IconLabel } from "@/components/icons";
import { hasProAccessFromSession } from "@/lib/plan-access";
import { getSession } from "@/lib/session";
import {
  ProCheckoutButton,
  ProManageBillingButton,
} from "@/components/ProCheckoutButton";

export function ProBillingPanel() {
  const { t } = useI18n();
  const session = getSession();
  const isPro = hasProAccessFromSession(session);

  if (!session?.email || session.role === "admin") return null;

  return (
    <section className="rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-5 space-y-3">
      <h2 className="font-semibold text-gray-900">
        <IconLabel icon={Sparkles} iconClassName="text-amber-600">
          {t("billing.sectionTitle", "Pro 訂閱")}
        </IconLabel>
      </h2>
      <p className="text-xs text-zinc-500 leading-relaxed">
        {t(
          "billing.sectionSubtitle",
          "Pro 解鎖微營養分析、AI 配餐、教練無限學員等進階功能。HK$20/月。"
        )}
      </p>
      {isPro ? (
        <>
          <p className="text-sm text-emerald-700 font-medium">
            {t("billing.currentPro", "你已是 Pro 會員")}
          </p>
          <ProManageBillingButton />
        </>
      ) : (
        <ProCheckoutButton />
      )}
    </section>
  );
}
