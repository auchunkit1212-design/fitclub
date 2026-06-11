import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/legal-config";
import { fetchStripeCustomerId } from "@/lib/stripe-billing";
import { getStripe } from "@/lib/stripe";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  try {
    const stripe = getStripe();
    const origin = getSiteUrl(new URL(request.url).origin);
    const email = session.email.trim().toLowerCase();
    const customerId = await fetchStripeCustomerId(email);

    if (!customerId) {
      return NextResponse.json(
        { error: "尚未訂閱 Pro，請先完成 Checkout。" },
        { status: 400 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法開啟帳單管理";
    console.error("[stripe/create-portal-session]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
