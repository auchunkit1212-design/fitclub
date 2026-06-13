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
  ownPlanPro?: boolean;
  canManageBilling: boolean;
  proSource: "subscription" | "coach" | "allowlist" | "none";
};

async function loadBillingStatus(): Promise<BillingStatus | null> {
  const res = await fetch("/api/me/billing", {
    credentials: "include",
    headers: getSessionRequestHeaders(),
  });
  if (!res.ok) return null;
  return (await res.json()) as BillingStatus;
}

export function ProBillingPanel() {
  const { t } = useI18n();
  const session = getSession();
  const isPro = hasProAccessFromSession(session);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const refreshBilling = async () => {
    const data = await loadBillingStatus();
    if (data) setBilling(data);
    return data;
  };

  useEffect(() => {
    if (!session?.email) return;
    void refreshBilling();
  }, [session?.email]);

  const handleSyncSubscription = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError("");
    try {
      const res = await fetch("/api/me/billing", {
        method: "POST",
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? t("billing.syncFailed", "同步失敗"));
      }
      await refreshBilling();
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : t("billing.syncFailed", "同步失敗")
      );
    } finally {
      setSyncing(false);
    }
  };

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
            <div className="space-y-2">
              <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2.5 leading-relaxed">
                {t(
                  "billing.syncPendingSelf",
                  "你已付款，但 Stripe 訂閱尚未連結到此帳戶。撳下面掣從 Stripe 同步（登入 Email 須同付款時一致）。"
                )}
              </p>
              <button
                type="button"
                disabled={syncing}
                onClick={() => void handleSyncSubscription()}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60 active:scale-95 transition-all"
              >
                {syncing
                  ? t("billing.syncing", "正在同步 Stripe...")
                  : t("billing.syncButton", "同步我的訂閱")}
              </button>
              {syncError ? (
                <p className="text-xs text-red-600 leading-relaxed">{syncError}</p>
              ) : null}
            </div>
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
