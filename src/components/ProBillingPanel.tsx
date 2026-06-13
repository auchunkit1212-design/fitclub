"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Sparkles, IconLabel } from "@/components/icons";
import { hasProAccessFromSession } from "@/lib/plan-access";
import { getSession, getSessionRequestHeaders } from "@/lib/session";
import { plansForSessionRole } from "@/lib/stripe-plans";
import {
  ProCheckoutButton,
  ProManageBillingButton,
} from "@/components/ProCheckoutButton";

type BillingStatus = {
  isPro: boolean;
  canManageBilling: boolean;
  proSource: "subscription" | "coach" | "allowlist" | "none";
};

export function ProBillingPanel() {
  const { t } = useI18n();
  const session = getSession();
  const isPro = hasProAccessFromSession(session);
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    if (!session?.email) return;
    void (async () => {
      try {
        const res = await fetch("/api/me/billing", {
          credentials: "include",
          headers: getSessionRequestHeaders(),
        });
        if (!res.ok) return;
        const data = (await res.json()) as BillingStatus;
        setBilling(data);
      } catch {
        // ignore
      }
    })();
  }, [session?.email]);

  if (!session?.email || session.role === "admin") return null;

  const availablePlans = plansForSessionRole(session.role);
  const canManage = billing?.canManageBilling === true;
  const proViaCoach = isPro && billing?.proSource === "coach";

  return (
    <section className="rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">
          <IconLabel icon={Sparkles} iconClassName="text-amber-600">
            {t("billing.sectionTitle", "訂閱方案")}
          </IconLabel>
        </h2>
        <p className="text-xs text-zinc-500 leading-relaxed mt-1">
          {t(
            "billing.sectionSubtitleDual",
            "選擇適合你嘅方案，透過 Stripe 安全付款。"
          )}
        </p>
      </div>

      {isPro ? (
        <>
          <p className="text-sm text-emerald-700 font-medium">
            {proViaCoach
              ? t("billing.currentProCoach", "你已是 Pro 會員（由教練提供）")
              : t("billing.currentPro", "你已是 Pro 會員")}
          </p>
          {proViaCoach ? (
            <p className="text-xs text-zinc-500 leading-relaxed">
              {t(
                "billing.coachProHint",
                "Pro 功能由你嘅 Pro 教練提供，無需自行管理 Stripe 訂閱。"
              )}
            </p>
          ) : canManage ? (
            <ProManageBillingButton />
          ) : (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2.5 leading-relaxed">
              {t(
                "billing.syncPending",
                "Pro 已啟用，但 Stripe 訂閱記錄尚未同步。若剛完成付款，請重新整理；否則請確認 Webhook 已設定。"
              )}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {availablePlans.map((plan, index) => (
            <div
              key={plan.key}
              className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-zinc-900">
                    {plan.name}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {plan.description}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-700">
                  {plan.priceLabel}
                </span>
              </div>
              <ProCheckoutButton
                plan={plan.key}
                priceId={plan.priceId}
                label={t(
                  plan.key === "solo"
                    ? "billing.upgradeSolo"
                    : "billing.upgradeCoachPro",
                  plan.key === "solo"
                    ? "升級 Solo 版（HK$68/月）"
                    : "升級 Pro 教練版（HK$399/月）"
                )}
                variant={index === 0 ? "primary" : "secondary"}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
