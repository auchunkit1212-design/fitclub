import { NextResponse } from "next/server";
import { FoodSearchError } from "@/lib/food-search/shared";
import {
  getOpenRouterModel,
  isOpenRouterConfigured,
  searchFoodWithOpenRouter,
} from "@/lib/food-search/openrouter";
import { normalizeLanguage } from "@/lib/i18n";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** OpenRouter LLM — 港台食物聯想 + 營養估算（Autocomplete） */
export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      {
        error: "AI 食物搜尋尚未設定，請設定 OPENROUTER_API_KEY",
        items: [],
        source: "openrouter" as const,
        configured: false,
      },
      { status: 503 }
    );
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

  if (query.length < 2) {
    return NextResponse.json({ error: "請至少輸入 2 個字元", items: [] }, { status: 400 });
  }

  try {
    const items = await searchFoodWithOpenRouter(query, lang);

    if (items.length === 0) {
      return NextResponse.json(
        {
          error: "搵唔到相關食物，請換個關鍵字再試",
          items: [],
          source: "openrouter" as const,
          model: getOpenRouterModel(),
          lang,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      items,
      source: "openrouter" as const,
      model: getOpenRouterModel(),
      lang,
    });
  } catch (error) {
    if (error instanceof FoodSearchError) {
      console.error("[food-search]", error.message);
      return NextResponse.json(
        { error: error.message, items: [], source: "openrouter" as const },
        { status: error.statusCode }
      );
    }
    console.error("[food-search]", error);
    return NextResponse.json(
      { error: "搜尋失敗，請稍後再試", items: [] },
      { status: 500 }
    );
  }
}
