import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/legal-config";
import { fetchStripeCustomerId } from "@/lib/stripe-billing";
import {
  assertPlanAllowedForRole,
  resolveCheckoutPriceId,
  type BillingPlanKey,
} from "@/lib/stripe-plans";
import { getStripe } from "@/lib/stripe";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  if (session.role === "admin") {
    return NextResponse.json({ error: "管理員無需訂閱" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const origin = getSiteUrl(new URL(request.url).origin);
    const email = session.email.trim().toLowerCase();

    let body: {
      priceId?: string;
      plan?: BillingPlanKey;
      lookup_key?: string;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // empty body ok
    }

    const defaultPlan: BillingPlanKey =
      session.role === "coach" ? "coach_pro" : "solo";

    const { priceId, planKey } = resolveCheckoutPriceId({
      priceId: body.priceId,
      plan: body.plan ?? defaultPlan,
      lookupKey: body.lookup_key,
    });

    assertPlanAllowedForRole(planKey, session.role);

    const existingCustomerId = await fetchStripeCustomerId(email);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existingCustomerId ?? undefined,
      customer_email: existingCustomerId ? undefined : email,
      client_reference_id: email,
      line_items: [{ price: priceId, quantity: 1 }],
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        email,
        role: session.role,
        plan_key: planKey ?? "",
      },
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "無法建立 Stripe Checkout" }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe Checkout 失敗";
    console.error("[stripe/create-checkout-session]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
