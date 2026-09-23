import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  setUserBillingPlan,
  subscriptionGrantsPro,
} from "@/lib/stripe-billing";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveEmailFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const metaEmail = subscription.metadata?.email?.trim().toLowerCase();
  if (metaEmail) return metaEmail;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return null;

  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const email = customer.email?.trim().toLowerCase();
  return email || null;
}

async function syncSubscription(
  subscription: Stripe.Subscription
): Promise<void> {
  const email = await resolveEmailFromSubscription(subscription);
  if (!email) {
    console.warn("[stripe/webhook] subscription without resolvable email", {
      id: subscription.id,
    });
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  await setUserBillingPlan(email, {
    plan: subscriptionGrantsPro(subscription.status) ? "pro" : "free",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
  });
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } else {
      event = JSON.parse(payload) as Stripe.Event;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook signature invalid";
    console.error("[stripe/webhook] verify failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkout = event.data.object as Stripe.Checkout.Session;
        const email =
          checkout.client_reference_id?.trim().toLowerCase() ||
          checkout.metadata?.email?.trim().toLowerCase() ||
          checkout.customer_details?.email?.trim().toLowerCase();

        const customerId =
          typeof checkout.customer === "string"
            ? checkout.customer
            : checkout.customer?.id ?? null;

        const subscriptionId =
          typeof checkout.subscription === "string"
            ? checkout.subscription
            : checkout.subscription?.id ?? null;

        if (email) {
          let subscriptionStatus: string | null = null;
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            subscriptionStatus = sub.status;
          }
          await setUserBillingPlan(email, {
            plan: subscriptionGrantsPro(subscriptionStatus) ? "pro" : "free",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripeSubscriptionStatus: subscriptionStatus,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe/webhook] handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
