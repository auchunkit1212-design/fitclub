import { NextRequest, NextResponse } from "next/server";
import {
  FREE_REGENERATE_PER_PLAN,
  getMainAppBillingUrl,
} from "@/lib/constants";
import { getStoredLanguageHint } from "@/lib/lang-from-request";
import { parseSessionFromRequest } from "@/lib/session-server";
import { resolveEffectiveIsPro } from "@/lib/user-plan";
import { generateWeeklyMealPlan } from "@/lib/weekly-meal-plan";
import {
  fetchDietProfile,
  fetchMealPlanById,
  updateMealPlanPayload,
} from "@/lib/wte-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    planId?: string;
    focusDate?: string;
    focusSlot?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  if (!body.planId) {
    return NextResponse.json({ error: "缺少 planId" }, { status: 400 });
  }

  const diet = await fetchDietProfile(session.email);
  if (!diet?.onboardingComplete) {
    return NextResponse.json(
      { error: "請先完成飲食檔案" },
      { status: 400 }
    );
  }

  const existing = await fetchMealPlanById(body.planId, session.email);
  if (!existing) {
    return NextResponse.json({ error: "找不到餐單" }, { status: 404 });
  }

  const isPro = await resolveEffectiveIsPro(session);
  if (!isPro && existing.regenerateCount >= FREE_REGENERATE_PER_PLAN) {
    return NextResponse.json(
      {
        error: "FREE_REGEN_LIMIT",
        message: `免費每個餐單最多 regenerate ${FREE_REGENERATE_PER_PLAN} 次。`,
        billingUrl: getMainAppBillingUrl(),
      },
      { status: 403 }
    );
  }

  const avoidTitles: string[] = [];
  for (const day of existing.payload.days) {
    for (const slot of day.slots) {
      avoidTitles.push(slot.eat_out.title, slot.cook.title);
    }
  }

  const lang = getStoredLanguageHint(request);
  const payload = await generateWeeklyMealPlan({
    targets: diet.targets,
    diet,
    weekStart: existing.weekStart,
    lang,
    regenerate: true,
    avoidTitles,
    focusDate: body.focusDate,
    focusSlot: body.focusSlot,
    existing: existing.payload,
  });

  try {
    const plan = await updateMealPlanPayload(
      body.planId,
      session.email,
      payload,
      true
    );
    return NextResponse.json({ plan, isPro });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新失敗";
    return NextResponse.json(
      {
        plan: {
          ...existing,
          payload,
          version: existing.version + 1,
          regenerateCount: existing.regenerateCount + 1,
        },
        isPro,
        warning: message,
      },
      { status: 200 }
    );
  }
}
