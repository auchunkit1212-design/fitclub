import { NextResponse } from "next/server";
import { applyMealLogStreak, insertMealLog } from "@/lib/db";
import { resolveMealLogEmail } from "@/lib/meal-log-auth";
import { MEAL_IMAGES_BUCKET } from "@/lib/meal-image-storage";
import { notifyCoachOfNewMealLog } from "@/lib/meal-notifications";
import { generateGorillaMealReview } from "@/lib/ai-solo-coach";
import { AI_GORILLA_COACH_EMAIL } from "@/lib/registry-constants";
import { fetchUserByEmail } from "@/lib/db";
import {
  fetchStudentNutritionTargets,
  insertMealReaction,
  studentHasCoach,
} from "@/lib/phase4-db";
import { fetchTenantById } from "@/lib/tenant";
import { isAiSoloTenantSlug } from "@/lib/ai-solo-coach";
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

  const body = (await request.json()) as {
    email?: string;
    mealType: string;
    description: string;
    imageUrl?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };

  const email = await resolveMealLogEmail(session, body.email);
  if (!email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  if (!body.description?.trim()) {
    return NextResponse.json({ error: "請填寫食物描述" }, { status: 400 });
  }

  try {
    const log = await insertMealLog(
      {
        email,
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

    try {
      const pushResult = await notifyCoachOfNewMealLog(log);
      if (pushResult.skipped) {
        console.info("[meals/log] coach push skipped:", pushResult.reason);
      } else if (pushResult.sent === 0) {
        console.warn(
          "[meals/log] coach push not delivered to:",
          pushResult.coachEmails
        );
      }
    } catch (err) {
      console.warn("[meals/log] coach alert failed:", err);
    }

    void (async () => {
      try {
        const student = await fetchUserByEmail(email);
        let solo = false;
        if (student?.tenantId) {
          const tenant = await fetchTenantById(student.tenantId);
          solo = isAiSoloTenantSlug(tenant?.slug);
        } else {
          solo = !studentHasCoach(student);
        }
        if (!solo) return;
        const targets = await fetchStudentNutritionTargets(email);
        const review = await generateGorillaMealReview(log, targets);
        await insertMealReaction(log.id, AI_GORILLA_COACH_EMAIL, review, {
          useServiceRole: true,
        });
      } catch (err) {
        console.warn("[meals/log] AI gorilla review failed:", err);
      }
    })();

    let streak = {
      currentStreak: 0,
      longestStreak: 0,
      milestoneTriggered: false as boolean,
      milestoneDays: undefined as number | undefined,
    };
    try {
      const streakResult = await applyMealLogStreak(email);
      streak = {
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
        milestoneTriggered: streakResult.milestoneTriggered,
        milestoneDays: streakResult.milestoneDays,
      };
    } catch (streakErr) {
      console.warn("[meals/log] streak update failed:", streakErr);
    }

    return NextResponse.json({
      log,
      streak,
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
        hint: "請在 Supabase 執行 fix-meal-logs-columns.sql（及 storage-food-images.sql）並確認 Vercel 已設 SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 500 }
    );
  }
}
