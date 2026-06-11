import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/legal-config";
import { fetchStripeCustomerId } from "@/lib/stripe-billing";
import { getStripe, getStripeTrialPeriodDays } from "@/lib/stripe";
import { resolveCheckoutPriceId } from "@/lib/stripe-prices";
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

    let body: { priceId?: string; tier?: string; lookup_key?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // empty body
    }

    const { priceId, tier } = resolveCheckoutPriceId(body);

    if (tier === "solo" && session.role === "coach") {
      return NextResponse.json(
        { error: "教練請選擇 Pro 專業教練版方案" },
        { status: 400 }
      );
    }
    if (tier === "coach_pro" && session.role === "student") {
      return NextResponse.json(
        { error: "學員請選擇 Solo AI 散客版方案" },
        { status: 400 }
      );
    }

    const existingCustomerId = await fetchStripeCustomerId(email);

    const trialDays = getStripeTrialPeriodDays();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existingCustomerId ?? undefined,
      customer_email: existingCustomerId ? undefined : email,
      client_reference_id: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          email,
          role: session.role,
          plan_tier: tier ?? "unknown",
        },
      },
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        email,
        role: session.role,
        plan_tier: tier ?? "unknown",
        price_id: priceId,
        trial_days: String(trialDays),
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
