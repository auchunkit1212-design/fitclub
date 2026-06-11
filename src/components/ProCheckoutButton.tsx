"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { ShoppingCart, IconLabel } from "@/components/icons";
import type { BillingPlanKey } from "@/lib/stripe-plans";
import { getSessionRequestHeaders } from "@/lib/session";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type ProCheckoutButtonProps = {
  variant?: "primary" | "secondary";
  className?: string;
  /** 直接傳 Stripe Price ID（例如 price_solo_placeholder） */
  priceId?: string;
  /** 或傳方案 key，由後端從 env 解析 Price ID */
  plan?: BillingPlanKey;
  label?: string;
};

export function ProCheckoutButton({
  variant = "primary",
  className = "",
  priceId,
  plan,
  label,
}: ProCheckoutButtonProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const payload: { priceId?: string; plan?: BillingPlanKey } = {};
      if (priceId) payload.priceId = priceId;
      else if (plan) payload.plan = plan;

      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? t("billing.checkoutFailed", "無法開始付款"));
      }
      window.location.href = data.url;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : t("billing.checkoutFailed", "無法開始付款")
      );
    } finally {
      setLoading(false);
    }
  };

  const base =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
      : "border border-emerald-200 bg-emerald-50 text-emerald-800";

  const buttonLabel =
    label ??
    (plan === "solo"
      ? t("billing.upgradeSolo", "升級 Solo 版（HK$68/月）")
      : plan === "coach_pro"
        ? t("billing.upgradeCoachPro", "升級 Pro 教練版（HK$399/月）")
        : t("billing.upgradePro", "升級 Pro"));

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void startCheckout()}
      className={`w-full font-semibold py-3 rounded-xl disabled:opacity-60 ${base} ${btnClass} ${className}`}
    >
      <IconLabel
        icon={ShoppingCart}
        className="justify-center"
        iconClassName={variant === "primary" ? "text-white" : "text-emerald-700"}
      >
        {loading ? t("billing.openingCheckout", "正在前往 Stripe...") : buttonLabel}
      </IconLabel>
    </button>
  );
}

export function ProManageBillingButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? t("billing.portalFailed", "無法開啟帳單管理"));
      }
      window.location.href = data.url;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : t("billing.portalFailed", "無法開啟帳單管理")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void openPortal()}
      className={`w-full border border-zinc-200 bg-white text-zinc-800 font-semibold py-3 rounded-xl disabled:opacity-60 ${btnClass} ${className}`}
    >
      {loading
        ? t("billing.openingPortal", "正在開啟...")
        : t("billing.manageBilling", "管理訂閱 / 付款方式")}
    </button>
  );
}
