export type StripePlanTier = "solo" | "coach_pro";

const SOLO_PLACEHOLDER = "price_solo_placeholder";
const COACH_PRO_PLACEHOLDER = "price_pro_placeholder";

export function getStripePriceIdSolo(): string {
  return process.env.STRIPE_PRICE_SOLO?.trim() || SOLO_PLACEHOLDER;
}

export function getStripePriceIdCoachPro(): string {
  return process.env.STRIPE_PRICE_PRO_COACH?.trim() || COACH_PRO_PLACEHOLDER;
}

export function getStripePriceIdForTier(tier: StripePlanTier): string {
  return tier === "solo" ? getStripePriceIdSolo() : getStripePriceIdCoachPro();
}

/** 只接受已設定嘅 Price ID，防止任意 price 被濫用 */
export function isAllowedStripePriceId(priceId: string): boolean {
  const normalized = priceId.trim();
  const allowed = new Set([getStripePriceIdSolo(), getStripePriceIdCoachPro()]);
  return allowed.has(normalized);
}

export function tierForPriceId(priceId: string): StripePlanTier | null {
  const normalized = priceId.trim();
  if (normalized === getStripePriceIdSolo()) return "solo";
  if (normalized === getStripePriceIdCoachPro()) return "coach_pro";
  return null;
}

export function resolveCheckoutPriceId(input: {
  priceId?: string;
  tier?: string;
  lookup_key?: string;
}): { priceId: string; tier: StripePlanTier | null } {
  const direct = input.priceId?.trim();
  if (direct) {
    if (!isAllowedStripePriceId(direct)) {
      throw new Error("不支援的 Stripe Price ID");
    }
    return { priceId: direct, tier: tierForPriceId(direct) };
  }

  const tier = input.tier?.trim();
  if (tier === "solo" || tier === "coach_pro") {
    const priceId = getStripePriceIdForTier(tier);
    return { priceId, tier };
  }

  throw new Error("請提供 priceId 或 tier（solo / coach_pro）");
}
