import { NextResponse } from "next/server";
import { searchFoodWithAI, searchFoodLocally } from "@/lib/food-search/ai-legacy";
import { searchFoodWithFatSecret } from "@/lib/food-search/fatsecret";
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

/** 主力路由：FatSecret + 本地茶餐廳 JSON → AI 估算 → 本地規則保底 */
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

  try {
    let source: FoodSearchItem["source"] = "fatsecret";
    let items: FoodSearchItem[] = [];

    const hkItems = searchHkFoodDatabase(query);
    let fatSecretItems: FoodSearchItem[] = [];
    try {
      fatSecretItems = await searchFoodWithFatSecret(query);
    } catch (err) {
      console.warn("[food-search] FatSecret unavailable", err);
    }

    if (hasCjk(query)) {
      items = [...hkItems, ...fatSecretItems];
      source = hkItems.length > 0 ? "hk" : "fatsecret";
    } else {
      items = [...fatSecretItems, ...hkItems];
      source = fatSecretItems.length > 0 ? "fatsecret" : "hk";
    }
    items = items.slice(0, 5);

    if (items.length === 0) {
      try {
        items = await searchFoodWithAI(query, lang);
        source = items[0]?.source ?? "gemini";
      } catch (err) {
        console.warn("[food-search] AI unavailable, local fallback", err);
      }
    }

    if (items.length === 0) {
      items = await searchFoodLocally(query, lang);
      source = "local";
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "搵唔到相關食物，請換個關鍵字再試", items: [], source: "local" },
        { status: 404 }
      );
    }

    return NextResponse.json({ items, source, lang });
  } catch (error) {
    if (error instanceof FoodSearchError) {
      console.error("[food-search]", error.message);
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[food-search]", error);
    return NextResponse.json({ error: "搜尋失敗，請稍後再試" }, { status: 500 });
  }
}
