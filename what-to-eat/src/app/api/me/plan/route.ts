import { NextRequest, NextResponse } from "next/server";
import {
  FREE_MONTHLY_GENERATE_LIMIT,
  getMainAppBillingUrl,
} from "@/lib/constants";
import { parseSessionFromRequest } from "@/lib/session-server";
import { resolveEffectiveIsPro } from "@/lib/user-plan";
import { currentMonthKey, getGenerateUsage } from "@/lib/wte-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const isPro = await resolveEffectiveIsPro(session);
  const monthKey = currentMonthKey();
  const used = await getGenerateUsage(session.email, monthKey);
  return NextResponse.json({
    isPro,
    plan: isPro ? "pro" : "free",
    monthKey,
    generateUsed: used,
    generateLimit: isPro ? null : FREE_MONTHLY_GENERATE_LIMIT,
    billingUrl: getMainAppBillingUrl(),
  });
}
