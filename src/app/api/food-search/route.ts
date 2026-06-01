import { NextResponse } from "next/server";
import { searchFoodWithAI, searchFoodLocally } from "@/lib/food-search/ai-legacy";
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
export const maxDuration = 30;

/** FatSecret OAuth 2.0 優先 → 茶餐廳 JSON → AI → 本地估算 */
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
  let fatSecretError: string | undefined;

  try {
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
        fatSecretError =
          "FatSecret search returned no foods for this query. Check /api/food-search/status on your deployment.";
        console.warn("[food-search]", fatSecretError, { query });
      } catch (err) {
        fatSecretError =
          err instanceof FoodSearchError
            ? err.message
            : err instanceof Error
              ? err.message
              : "FatSecret request failed";
        console.error("[food-search] FatSecret error", fatSecretError);
      }
    } else {
      fatSecretError = "FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET not set on server";
      console.warn("[food-search]", fatSecretError);
    }

    const hkItems = searchHkFoodDatabase(query);
    if (hkItems.length > 0) {
      return NextResponse.json({
        items: hkItems.slice(0, 5),
        source: "hk" as const,
        lang,
        fatSecretConfigured,
        warning: fatSecretError,
      });
    }

    try {
      const aiItems = await searchFoodWithAI(query, lang);
      if (aiItems.length > 0) {
        return NextResponse.json({
          items: aiItems,
          source: aiItems[0]?.source ?? "gemini",
          lang,
          fatSecretConfigured,
          warning: fatSecretError,
        });
      }
    } catch (err) {
      console.warn("[food-search] AI unavailable", err);
    }

    const localItems = await searchFoodLocally(query, lang);
    if (localItems.length > 0) {
      return NextResponse.json({
        items: localItems,
        source: "local" as const,
        lang,
        fatSecretConfigured,
        warning:
          fatSecretError ??
          (fatSecretConfigured
            ? "Using estimated macros."
            : "FatSecret not configured; using estimated macros."),
      });
    }

    return NextResponse.json(
      {
        error: fatSecretConfigured
          ? fatSecretError ?? "搵唔到相關食物，請換個關鍵字再試"
          : "食物資料庫未連線，請設定 FatSecret API 環境變數",
        items: [] as FoodSearchItem[],
        source: "local" as const,
        fatSecretConfigured,
        fatSecretError,
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
