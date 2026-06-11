import { getSupabaseServiceRole } from "@/lib/supabase-admin";
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

export async function fetchStripeSubscriptionStatus(
  email: string
): Promise<string | null> {
  const admin = getSupabaseServiceRole();
  const { data, error } = await admin
    .from("users_registry")
    .select("stripe_subscription_status")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  const status = data?.stripe_subscription_status;
  return typeof status === "string" && status.trim() ? status.trim() : null;
}

export async function setUserBillingPlan(
  email: string,
  patch: {
    plan?: UserPlan;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeSubscriptionStatus?: string | null;
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
  if (patch.stripeSubscriptionStatus !== undefined) {
    update.stripe_subscription_status = patch.stripeSubscriptionStatus;
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
