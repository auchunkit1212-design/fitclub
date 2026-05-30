import { NextResponse } from "next/server";
import { insertMealLog } from "@/lib/db";
import { MEAL_IMAGES_BUCKET } from "@/lib/meal-image-storage";
import { notifyCoachOfNewMealLog } from "@/lib/meal-notifications";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";
import { getSupabasePublicEnvStatus } from "@/lib/supabase-env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const env = getSupabasePublicEnvStatus();
  if (!env.ok) {
    return NextResponse.json(
      {
        error: "伺服器缺少 Supabase 環境變數（NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）",
        code: "MISSING_SUPABASE_ENV",
        env,
      },
      { status: 500 }
    );
  }

  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    mealType: string;
    description: string;
    imageUrl?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };

  if (!body.description?.trim()) {
    return NextResponse.json({ error: "請填寫食物描述" }, { status: 400 });
  }

  try {
    const log = await insertMealLog(
      {
        email: session.email,
        mealType: body.mealType,
        description: body.description.trim(),
        imageUrl: body.imageUrl?.trim() || undefined,
        calories: Number(body.calories) || 0,
        protein: Number(body.protein) || 0,
        carbs: Number(body.carbs) || 0,
        fats: Number(body.fats) || 0,
      },
      { useServiceRole: true }
    );

    notifyCoachOfNewMealLog(log).catch((err) =>
      console.warn("[push] coach alert failed:", err)
    );

    return NextResponse.json({
      log,
      imageStorage: body.imageUrl ? MEAL_IMAGES_BUCKET : undefined,
    });
  } catch (error) {
    const readable = toReadableError(error, "儲存失敗");
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : undefined;
    return NextResponse.json(
      {
        error: readable.message,
        code: code ?? "DB_ERROR",
        hint: "請確認 meal_logs 表含 image_url 欄位（執行 storage-food-images.sql）及 Vercel 已設 SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 500 }
    );
  }
}
