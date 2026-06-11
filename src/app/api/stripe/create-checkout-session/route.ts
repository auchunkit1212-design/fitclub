import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/legal-config";
import {
  fetchStripeCustomerId,
  setUserBillingPlan,
} from "@/lib/stripe-billing";
import { getStripe, getStripePriceLookupKey, resolveStripePriceId } from "@/lib/stripe";
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

    let body: { lookup_key?: string } = {};
    try {
      body = (await request.json()) as { lookup_key?: string };
    } catch {
      // empty body ok
    }

    const lookupKey = body.lookup_key?.trim() || getStripePriceLookupKey();
    const priceId = await resolveStripePriceId(lookupKey);
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
