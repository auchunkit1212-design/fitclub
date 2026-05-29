import { NextResponse } from "next/server";
import { insertMealLog } from "@/lib/db";
import { notifyCoachOfNewMealLog } from "@/lib/meal-notifications";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    mealType: string;
    description: string;
    imageBase64?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };

  if (!body.description?.trim()) {
    return NextResponse.json({ error: "請填寫食物描述" }, { status: 400 });
  }

  try {
    const log = await insertMealLog({
      email: session.email,
      mealType: body.mealType,
      description: body.description.trim(),
      imageBase64: body.imageBase64,
      calories: Number(body.calories) || 0,
      protein: Number(body.protein) || 0,
      carbs: Number(body.carbs) || 0,
      fats: Number(body.fats) || 0,
    });

    notifyCoachOfNewMealLog(log).catch((err) =>
      console.warn("[push] coach alert failed:", err)
    );

    return NextResponse.json({ log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
