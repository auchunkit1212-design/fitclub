import { NextResponse } from "next/server";
import { FoodSearchError } from "@/lib/food-search/shared";
import {
  getLocalFoodDatabaseStats,
  searchLocalFoodDatabase,
} from "@/lib/food-search/local-database";
import {
  getOpenRouterAutocompleteModel,
  getOpenRouterModel,
  isOpenRouterConfigured,
  searchFoodWithOpenRouter,
} from "@/lib/food-search/openrouter";
import { normalizeLanguage } from "@/lib/i18n";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** 最優先 OpenRouter AI；AI 失敗或無結果時才 fallback 本地庫 */
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

  if (query.length < 1) {
    return NextResponse.json({ error: "請輸入食物名稱", items: [] }, { status: 400 });
  }

  const dbStats = getLocalFoodDatabaseStats();
  const localItems = searchLocalFoodDatabase(query, 12);

  if (isOpenRouterConfigured()) {
    try {
      const items = await searchFoodWithOpenRouter(query, lang);

      if (items.length > 0) {
        return NextResponse.json({
          items,
          source: "openrouter" as const,
          model: getOpenRouterAutocompleteModel(),
          lang,
          databaseSize: dbStats.total,
          localMatch: false,
        });
      }
    } catch (error) {
      if (error instanceof FoodSearchError) {
        console.warn("[food-search] AI failed, fallback local DB:", error.message);
      } else {
        console.warn("[food-search] AI failed, fallback local DB:", error);
      }
    }
  }

  if (localItems.length > 0) {
    return NextResponse.json({
      items: localItems,
      source: localItems[0]?.source ?? "hk_tw",
      lang,
      databaseSize: dbStats.total,
      localMatch: true,
      aiFallback: isOpenRouterConfigured(),
    });
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      {
        error:
          "搵唔到相關食物。請設定 OPENROUTER_API_KEY 啟用 AI 聯想，或試「魚蛋」「燒賣」等關鍵字",
        items: [],
        source: "local" as const,
        configured: false,
        databaseSize: dbStats.total,
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      error: "搵唔到相關食物，請換個關鍵字再試",
      items: [],
      source: "openrouter" as const,
      model: getOpenRouterModel(),
      lang,
      databaseSize: dbStats.total,
    },
    { status: 404 }
  );
}
