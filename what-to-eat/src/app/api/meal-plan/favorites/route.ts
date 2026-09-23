import { NextRequest, NextResponse } from "next/server";
import { getMainAppBillingUrl } from "@/lib/constants";
import { parseSessionFromRequest } from "@/lib/session-server";
import { resolveEffectiveIsPro } from "@/lib/user-plan";
import {
  addFavorite,
  fetchLatestMealPlan,
  listFavorites,
  removeFavorite,
} from "@/lib/wte-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const latest = await fetchLatestMealPlan(session.email);
  const isPro = await resolveEffectiveIsPro(session);
  let favorites: Awaited<ReturnType<typeof listFavorites>> = [];
  if (isPro) {
    try {
      favorites = await listFavorites(session.email);
    } catch {
      favorites = [];
    }
  }
  return NextResponse.json({ latest, favorites, isPro });
}

export async function POST(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const isPro = await resolveEffectiveIsPro(session);
  if (!isPro) {
    return NextResponse.json(
      {
        error: "PRO_REQUIRED",
        message: "收藏功能需要 Pro",
        billingUrl: getMainAppBillingUrl(),
      },
      { status: 403 }
    );
  }

  let body: { planId?: string; action?: "add" | "remove" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  if (!body.planId) {
    return NextResponse.json({ error: "缺少 planId" }, { status: 400 });
  }

  try {
    if (body.action === "remove") {
      await removeFavorite(session.email, body.planId);
    } else {
      await addFavorite(session.email, body.planId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
