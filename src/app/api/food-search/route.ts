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

type FoodSearchMode = "ai-first" | "local";

/** AI 聯想優先；mode=local 只查本地庫（供前端等候 AI 時顯示預覽） */
export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let query = "";
  let lang = normalizeLanguage("zh-HK");
  let mode: FoodSearchMode = "ai-first";
  try {
    const body = (await request.json()) as {
      query?: string;
      lang?: string;
      mode?: FoodSearchMode;
    };
    query = body.query?.trim() ?? "";
    lang = normalizeLanguage(body.lang);
    if (body.mode === "local") mode = "local";
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

  // 單字搜尋：本地庫即時有結果就即刻返（避免等 AI）
  if (query.length === 1 && localItems.length > 0) {
    return NextResponse.json({
      items: localItems,
      source: localItems[0]?.source ?? "hk_tw",
      lang,
      databaseSize: dbStats.total,
      localMatch: true,
    });
  }

  if (mode === "local") {
    return NextResponse.json({
      items: localItems,
      source: localItems[0]?.source ?? "hk_tw",
      lang,
      databaseSize: dbStats.total,
      localMatch: true,
      preview: true,
    });
  }

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
        console.warn("[food-search] AI failed, trying local DB:", error.message);
      } else {
        console.warn("[food-search] AI failed, trying local DB:", error);
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
