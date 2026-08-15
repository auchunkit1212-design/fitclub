import { NextRequest, NextResponse } from "next/server";
import {
  FREE_MONTHLY_GENERATE_LIMIT,
  getMainAppBillingUrl,
} from "@/lib/constants";
import { getStoredLanguageHint } from "@/lib/lang-from-request";
import { parseSessionFromRequest } from "@/lib/session-server";
import { resolveEffectiveIsPro } from "@/lib/user-plan";
import { generateWeeklyMealPlan } from "@/lib/weekly-meal-plan";
import {
  currentMonthKey,
  fetchDietProfile,
  getGenerateUsage,
  incrementGenerateUsage,
  insertMealPlan,
  mondayOfWeek,
} from "@/lib/wte-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const diet = await fetchDietProfile(session.email);
  if (!diet?.onboardingComplete) {
    return NextResponse.json(
      { error: "請先完成飲食檔案 onboarding" },
      { status: 400 }
    );
  }

  const isPro = await resolveEffectiveIsPro(session);
  const monthKey = currentMonthKey();
  const used = await getGenerateUsage(session.email, monthKey);
  if (!isPro && used >= FREE_MONTHLY_GENERATE_LIMIT) {
    return NextResponse.json(
      {
        error: "FREE_LIMIT",
        message: `免費每月限 ${FREE_MONTHLY_GENERATE_LIMIT} 次生成一週餐單。升級 Pro 無限使用。`,
        billingUrl: getMainAppBillingUrl(),
      },
      { status: 403 }
    );
  }

  let notes = "";
  try {
    const body = (await request.json()) as { notes?: string; lang?: string };
    notes = body.notes?.trim() ?? "";
  } catch {
    // empty body ok
  }

  const weekStart = mondayOfWeek();
  const lang = getStoredLanguageHint(request);
  const payload = await generateWeeklyMealPlan({
    targets: diet.targets,
    diet,
    weekStart,
    lang,
  });

  try {
    if (!isPro) {
      await incrementGenerateUsage(session.email, monthKey);
    }
    const plan = await insertMealPlan({
      email: session.email,
      weekStart,
      payload,
      notes: notes || undefined,
    });
    return NextResponse.json({ plan, isPro });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失敗";
    // Tables may not exist yet — still return AI payload for local preview
    if (message.includes("儲存餐單失敗") || message.includes("wte_")) {
      return NextResponse.json({
        plan: {
          id: "local-preview",
          email: session.email,
          weekStart,
          payload,
          notes,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          regenerateCount: 0,
        },
        isPro,
        warning: message,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
