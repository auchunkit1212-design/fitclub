import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import type { UserPlan } from "@/lib/types";

export async function fetchStripeCustomerId(email: string): Promise<string | null> {
  const admin = getSupabaseServiceRole();
  const { data, error } = await admin
    .from("users_registry")
    .select("stripe_customer_id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  const id = data?.stripe_customer_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** DB 搵唔到時，向 Stripe 用 email 查 customer 並可寫回 DB */
export async function resolveStripeCustomerId(
  email: string,
  options?: { persistIfFound?: boolean }
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const fromDb = await fetchStripeCustomerId(normalized);
  if (fromDb) return fromDb;

  try {
    const stripe = getStripe();
    const customers = await stripe.customers.list({
      email: normalized,
      limit: 1,
    });
    const customerId = customers.data[0]?.id;
    if (!customerId) return null;

    if (options?.persistIfFound !== false) {
      await setUserBillingPlan(normalized, { stripeCustomerId: customerId });
    }
    return customerId;
  } catch (err) {
    console.warn("[stripe-billing] resolve customer by email failed:", err);
    return null;
  }
}

export async function syncCheckoutSessionToUser(
  checkoutSessionId: string,
  expectedEmail: string
): Promise<{ ok: boolean; error?: string }> {
  const stripe = getStripe();
  const normalized = expectedEmail.trim().toLowerCase();

  const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  const email =
    checkout.client_reference_id?.trim().toLowerCase() ||
    checkout.metadata?.email?.trim().toLowerCase() ||
    checkout.customer_details?.email?.trim().toLowerCase();

  if (!email || email !== normalized) {
    return { ok: false, error: "Checkout 與登入帳戶不符" };
  }

  const customerId =
    typeof checkout.customer === "string"
      ? checkout.customer
      : checkout.customer?.id ?? null;

  const subscriptionId =
    typeof checkout.subscription === "string"
      ? checkout.subscription
      : checkout.subscription?.id ?? null;

  const paid =
    checkout.payment_status === "paid" || checkout.status === "complete";

  if (!paid) {
    return { ok: false, error: "付款尚未完成" };
  }

  await setUserBillingPlan(email, {
    plan: "pro",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  return { ok: true };
}

export async function setUserBillingPlan(
  email: string,
  patch: {
    plan?: UserPlan;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }
): Promise<void> {
  const admin = getSupabaseServiceRole();
  const normalized = email.trim().toLowerCase();
  const update: Record<string, string | null> = {};

  if (patch.plan) update.plan = patch.plan;
  if (patch.stripeCustomerId !== undefined) {
    update.stripe_customer_id = patch.stripeCustomerId;
  }
  if (patch.stripeSubscriptionId !== undefined) {
    update.stripe_subscription_id = patch.stripeSubscriptionId;
  }

  if (Object.keys(update).length === 0) return;

  const { error } = await admin
    .from("users_registry")
    .update(update)
    .eq("email", normalized);

  if (error) throw error;
}

export function subscriptionGrantsPro(
  status: string | null | undefined
): boolean {
  return status === "active" || status === "trialing";
}
