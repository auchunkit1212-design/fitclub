import { NextResponse } from "next/server";
import { deleteMealLog, updateMealLog } from "@/lib/db";
import { assertCanEditMealLog, fetchMealLogById } from "@/lib/meal-log-access";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function PATCH(request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const id = context.params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少記錄 ID" }, { status: 400 });
  }

  const existing = await fetchMealLogById(id, { useServiceRole: true });
  if (!existing) {
    return NextResponse.json({ error: "找不到飲食記錄" }, { status: 404 });
  }

  const access = await assertCanEditMealLog(session, existing);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = (await request.json()) as {
    description?: string;
    mealType?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  };

  try {
    const updated = await updateMealLog(
      id,
      {
        description: body.description?.trim() ?? existing.description,
        mealType: body.mealType?.trim() ?? existing.mealType,
        calories: Math.max(0, Math.round(Number(body.calories) || 0)),
        protein: Math.max(0, Math.round(Number(body.protein) || 0)),
        carbs: Math.max(0, Math.round(Number(body.carbs) || 0)),
        fats: Math.max(0, Math.round(Number(body.fats) || 0)),
      },
      { useServiceRole: true }
    );

    return NextResponse.json({ ok: true, log: updated });
  } catch (error) {
    const readable = toReadableError(error, "更新失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const id = context.params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少記錄 ID" }, { status: 400 });
  }

  const existing = await fetchMealLogById(id, { useServiceRole: true });
  if (!existing) {
    return NextResponse.json({ error: "找不到飲食記錄" }, { status: 404 });
  }

  const access = await assertCanEditMealLog(session, existing);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    await deleteMealLog(id, { useServiceRole: true });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const readable = toReadableError(error, "刪除失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}
