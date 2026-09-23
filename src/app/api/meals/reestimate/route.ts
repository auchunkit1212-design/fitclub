import { NextResponse } from "next/server";
import { updateMealLog } from "@/lib/db";
import { assertCanEditMealLog, fetchMealLogById } from "@/lib/meal-log-access";
import { reestimateMealFromDescription } from "@/lib/meal-reestimate";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    mealLogId?: string;
    description?: string;
    apply?: boolean;
    coachHint?: {
      calories?: number;
      protein?: number;
      carbs?: number;
      fats?: number;
    };
  };

  const mealLogId = body.mealLogId?.trim();
  if (!mealLogId) {
    return NextResponse.json({ error: "缺少 mealLogId" }, { status: 400 });
  }

  const existing = await fetchMealLogById(mealLogId, { useServiceRole: true });
  if (!existing) {
    return NextResponse.json({ error: "找不到飲食記錄" }, { status: 404 });
  }

  const access = await assertCanEditMealLog(session, existing);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const description = (body.description ?? existing.description).trim();
  const hintCal = Number(body.coachHint?.calories);
  const coachHint =
    body.coachHint && Number.isFinite(hintCal) && hintCal >= 0
      ? {
          calories: Math.round(hintCal),
          protein: Math.round(Number(body.coachHint?.protein) || 0),
          carbs: Math.round(Number(body.coachHint?.carbs) || 0),
          fats: Math.round(Number(body.coachHint?.fats) || 0),
        }
      : undefined;

  try {
    const estimate = await reestimateMealFromDescription({
      description,
      coachHint,
    });

    if (!body.apply) {
      return NextResponse.json({
        ok: true,
        estimate: estimate.macros,
        source: estimate.source,
        parts: estimate.parts,
      });
    }

    const updated = await updateMealLog(
      mealLogId,
      {
        description,
        calories: estimate.macros.calories,
        protein: estimate.macros.protein,
        carbs: estimate.macros.carbs,
        fats: estimate.macros.fats,
      },
      { useServiceRole: true }
    );

    return NextResponse.json({
      ok: true,
      log: updated,
      estimate: estimate.macros,
      source: estimate.source,
      parts: estimate.parts,
    });
  } catch (error) {
    const readable = toReadableError(error, "AI 重算失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}
