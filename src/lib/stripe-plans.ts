import type { UserSession } from "@/lib/types";

export type BillingPlanKey = "solo" | "coach_pro";

export type BillingPlanConfig = {
  key: BillingPlanKey;
  name: string;
  priceLabel: string;
  description: string;
  priceId: string;
  roles: Array<"student" | "coach">;
};

function readPriceId(
  serverEnv: string | undefined,
  publicEnv: string | undefined,
  fallback: string
): string {
  return (
    serverEnv?.trim() ||
    publicEnv?.trim() ||
    fallback
  );
}

export function getSoloPriceId(): string {
  return readPriceId(
    process.env.STRIPE_PRICE_SOLO,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_SOLO,
    "price_solo_placeholder"
  );
}

export function getCoachProPriceId(): string {
  return readPriceId(
    process.env.STRIPE_PRICE_COACH_PRO,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_COACH_PRO,
    "price_pro_placeholder"
  );
}

export function getBillingPlans(): BillingPlanConfig[] {
  return [
    {
      key: "solo",
      name: "Solo AI 散客版",
      priceLabel: "HK$68/月",
      description: "微營養分析、AI 推薦菜單、AI 大猩猩私教",
      priceId: getSoloPriceId(),
      roles: ["student"],
    },
    {
      key: "coach_pro",
      name: "Pro 專業教練版",
      priceLabel: "HK$399/月",
      description: "無限學員名額、旗下學員享有 Pro 功能、教練進階工具",
      priceId: getCoachProPriceId(),
      roles: ["coach"],
    },
  ];
}

export function getBillingPlanByKey(
  key: BillingPlanKey
): BillingPlanConfig | undefined {
  return getBillingPlans().find((p) => p.key === key);
}

export function getAllowedStripePriceIds(): string[] {
  return getBillingPlans().map((p) => p.priceId);
}

export function resolveCheckoutPriceId(input: {
  priceId?: string | null;
  plan?: BillingPlanKey | null;
  lookupKey?: string | null;
}): { priceId: string; planKey?: BillingPlanKey } {
  const allowed = getBillingPlans();

  if (input.plan) {
    const match = getBillingPlanByKey(input.plan);
    if (!match) {
      throw new Error("無效的訂閱方案");
    }
    return { priceId: match.priceId, planKey: match.key };
  }

  const priceId = input.priceId?.trim();
  if (priceId) {
    const match = allowed.find((p) => p.priceId === priceId);
    if (!match) {
      throw new Error("無效的 Stripe Price ID");
    }
    return { priceId: match.priceId, planKey: match.key };
  }

  throw new Error("請提供 priceId 或 plan");
}

export function assertPlanAllowedForRole(
  planKey: BillingPlanKey | undefined,
  role: UserSession["role"]
): void {
  if (!planKey || role === "admin") return;

  const plan = getBillingPlanByKey(planKey);
  if (!plan) return;

  const effectiveRole = role === "coach" ? "coach" : "student";
  if (!plan.roles.includes(effectiveRole)) {
    if (planKey === "solo") {
      throw new Error("Solo 散客版只適用於學員帳戶");
    }
    throw new Error("Pro 教練版只適用於教練帳戶");
  }
}

export function plansForSessionRole(
  role: UserSession["role"] | undefined
): BillingPlanConfig[] {
  if (role === "coach") {
    return getBillingPlans().filter((p) => p.roles.includes("coach"));
  }
  return getBillingPlans().filter((p) => p.roles.includes("student"));
}
