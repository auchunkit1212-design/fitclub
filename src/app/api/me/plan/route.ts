import { NextRequest, NextResponse } from "next/server";
import { fetchUserByEmailForAuth } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { fetchStripeSubscriptionStatus } from "@/lib/stripe-billing";
import {
  applyEffectivePlanToSession,
  normalizeUserPlan,
  resolveEffectiveIsPro,
} from "@/lib/user-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "admin") {
    return NextResponse.json({ plan: "pro", isPro: true });
  }

  try {
    const user = await fetchUserByEmailForAuth(session.email);
    const enriched = await applyEffectivePlanToSession(session, user ?? undefined);
    const subscriptionStatus = await fetchStripeSubscriptionStatus(session.email);
    return NextResponse.json({
      plan: enriched.plan ?? "free",
      isPro: enriched.isPro === true,
      isProTrial: subscriptionStatus === "trialing",
    });
  } catch (err) {
    console.error("[me/plan]", err);
    const isPro = await resolveEffectiveIsPro(session);
    return NextResponse.json({
      plan: normalizeUserPlan(session.plan),
      isPro,
      isProTrial: false,
    });
  }
}
