import { NextRequest, NextResponse } from "next/server";
import { fetchUserByEmailForAuth } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";
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
    return NextResponse.json(
      {
        plan: enriched.plan ?? "free",
        isPro: enriched.isPro === true,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("[me/plan]", err);
    const isPro = await resolveEffectiveIsPro(session);
    return NextResponse.json({
      plan: normalizeUserPlan(session.plan),
      isPro,
    });
  }
}
