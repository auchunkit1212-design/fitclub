import { NextResponse } from "next/server";
import { searchFoodWithAI } from "@/lib/food-search/ai-legacy";
import {
  isFatSecretConfigured,
  searchFoodWithFatSecret,
} from "@/lib/food-search/fatsecret";
import { searchHkFoodDatabase } from "@/lib/food-search/hk-fallback";
import { FoodSearchError } from "@/lib/food-search/shared";
import { normalizeLanguage } from "@/lib/i18n";
import { parseSessionFromRequest } from "@/lib/session-server";
import type { FoodSearchItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/** 主力路由：FatSecret 優先 → 本地茶餐廳 JSON → AI（已設定 FatSecret 時不用本地估算） */
export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let query = "";
  let lang = normalizeLanguage("zh-HK");
  try {
    const body = (await request.json()) as { query?: string; lang?: string };
    query = body.query?.trim() ?? "";
    lang = normalizeLanguage(body.lang);
  } catch {
    return NextResponse.json({ error: "請提供 query" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "請輸入食物名稱" }, { status: 400 });
  }

  const fatSecretConfigured = isFatSecretConfigured();

  try {
    // 1) FatSecret 第一優先 — 有結果即回傳，不混入本地估算
    if (fatSecretConfigured) {
      try {
        const fatSecretItems = await searchFoodWithFatSecret(query);
        if (fatSecretItems.length > 0) {
          return NextResponse.json({
            items: fatSecretItems.slice(0, 5),
            source: "fatsecret" as const,
            lang,
            fatSecretConfigured: true,
          });
        }
      } catch (err) {
        console.warn("[food-search] FatSecret error", err);
      }
    } else {
      console.warn(
        "[food-search] FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET not set — using fallbacks only"
      );
    }

    // 2) 茶餐廳本地庫（中文查詢或 FatSecret 無結果）
    const hkItems = searchHkFoodDatabase(query);
    if (hkItems.length > 0) {
      return NextResponse.json({
        items: hkItems.slice(0, 5),
        source: "hk" as const,
        lang,
        fatSecretConfigured,
      });
    }

    // 3) AI 估算（FatSecret 已設定時仍可用，但絕不用本地規則）
    if (!fatSecretConfigured || hasCjk(query)) {
      try {
        const aiItems = await searchFoodWithAI(query, lang);
        if (aiItems.length > 0) {
          return NextResponse.json({
            items: aiItems,
            source: aiItems[0]?.source ?? "gemini",
            lang,
            fatSecretConfigured,
          });
        }
      } catch (err) {
        console.warn("[food-search] AI unavailable", err);
      }
    }

    // 4) 僅在未設定 FatSecret 時才用本地規則（避免錯誤 Smart estimate）
    if (!fatSecretConfigured) {
      const { searchFoodLocally } = await import("@/lib/food-search/ai-legacy");
      const localItems = await searchFoodLocally(query, lang);
      if (localItems.length > 0) {
        return NextResponse.json({
          items: localItems,
          source: "local" as const,
          lang,
          fatSecretConfigured: false,
        });
      }
    }

    return NextResponse.json(
      {
        error: fatSecretConfigured
          ? "搵唔到相關食物，請換個關鍵字再試"
          : "食物資料庫未連線，請聯絡管理員設定 FatSecret API",
        items: [] as FoodSearchItem[],
        source: "local" as const,
        fatSecretConfigured,
      },
      { status: 404 }
    );
  } catch (error) {
    if (error instanceof FoodSearchError) {
      console.error("[food-search]", error.message);
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[food-search]", error);
    return NextResponse.json({ error: "搜尋失敗，請稍後再試" }, { status: 500 });
  }
}
