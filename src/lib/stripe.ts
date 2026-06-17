import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key || null;
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("缺少 STRIPE_SECRET_KEY 環境變數");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function getStripePriceLookupKey(): string {
  return (
    process.env.STRIPE_PRICE_LOOKUP_KEY?.trim() || "nutrition_coach_pro_monthly"
  );
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/** 新訂閱免費試用天數（Checkout subscription_data.trial_period_days） */
export function getStripeTrialPeriodDays(): number {
  const raw = process.env.STRIPE_TRIAL_DAYS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export async function resolveStripePriceId(
  lookupKey = getStripePriceLookupKey()
): Promise<string> {
  const stripe = getStripe();
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });
  const price = prices.data[0];
  if (!price?.id) {
    throw new Error(
      `找不到 Stripe Price（lookup_key=${lookupKey}）。請在 Stripe Dashboard 設定 lookup key。`
    );
  }
  return price.id;
}
