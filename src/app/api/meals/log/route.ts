import { NextResponse } from "next/server";
import { insertMealLog } from "@/lib/db";
import { uploadMealImageToStorage } from "@/lib/meal-image-storage";
import { notifyCoachOfNewMealLog } from "@/lib/meal-notifications";
import { parseSessionFromRequest } from "@/lib/session-server";
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
    let imageUrl: string | undefined;
    let imageBase64: string | undefined;

    if (body.imageBase64?.trim()) {
      try {
        imageUrl = await uploadMealImageToStorage(
          session.email,
          body.imageBase64.trim()
        );
      } catch (storageErr) {
        const msg =
          storageErr instanceof Error ? storageErr.message : "Storage failed";
        console.warn("[meals/log] Storage upload failed, fallback base64:", msg);

        if (msg.includes("Bucket not found") || msg.includes("bucket")) {
          return NextResponse.json(
            {
              error:
                "找不到 food-images Storage Bucket，請在 Supabase 執行 supabase/storage-food-images.sql",
              code: "STORAGE_BUCKET_MISSING",
              detail: msg,
            },
            { status: 500 }
          );
        }

        imageBase64 = body.imageBase64.trim();
      }
    }

    const log = await insertMealLog(
      {
        email: session.email,
        mealType: body.mealType,
        description: body.description.trim(),
        imageBase64,
        imageUrl,
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

    return NextResponse.json({ log, imageStorage: imageUrl ? "food-images" : "base64" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存失敗";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : undefined;
    return NextResponse.json(
      {
        error: message,
        code: code ?? "DB_ERROR",
        hint: "請確認 Supabase meal_logs 表、RLS 及 storage-food-images.sql 已執行",
      },
      { status: 500 }
    );
  }
}
