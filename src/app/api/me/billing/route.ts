import { NextResponse } from "next/server";
import { fetchUserByEmailForAuth } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";
import {
  fetchStripeCustomerId,
  resolveStripeCustomerId,
  syncStripeBillingForUser,
} from "@/lib/stripe-billing";
import {
  normalizeUserPlan,
  resolveEffectiveIsPro,
} from "@/lib/user-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ProBillingSource = "subscription" | "coach" | "allowlist" | "none";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const email = session.email.trim().toLowerCase();
  const user = await fetchUserByEmailForAuth(email);
  const isPro = await resolveEffectiveIsPro(session, user ?? undefined);
  const ownPlanPro =
    user && normalizeUserPlan(user.plan) === "pro";

  let stripeCustomerId = await fetchStripeCustomerId(email);
  if (!stripeCustomerId && ownPlanPro) {
    stripeCustomerId = await resolveStripeCustomerId(email);
  }

  let proSource: ProBillingSource = "none";
  if (isPro) {
    if (stripeCustomerId || ownPlanPro) {
      proSource = "subscription";
    } else {
      proSource = "coach";
    }
  }

  return NextResponse.json({
    isPro,
    ownPlanPro: Boolean(ownPlanPro),
    hasStripeCustomer: Boolean(stripeCustomerId),
    canManageBilling: Boolean(stripeCustomerId),
    proSource,
  });
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const email = session.email.trim().toLowerCase();
  const result = await syncStripeBillingForUser(email);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "同步失敗" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    hasStripeCustomer: true,
    canManageBilling: true,
    proSource: "subscription" as const,
  });
}
