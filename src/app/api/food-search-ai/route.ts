import { NextResponse } from "next/server";
import { searchFoodWithAI, FoodSearchError } from "@/lib/food-search/ai-legacy";
import { normalizeLanguage } from "@/lib/i18n";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 【封印備用】AI 食物搜尋（OpenAI / Gemini / local）
 * 預設前端走 /api/food-search；需要重新啟用 AI 時可改前端或設 FOOD_SEARCH_AI_PROVIDER
 */
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
    const items = await searchFoodWithAI(query, lang);
    const provider = (process.env.FOOD_SEARCH_AI_PROVIDER || "gemini").toLowerCase();
    const source =
      provider === "openai" ? "openai" : provider === "local" ? "local" : "gemini";
    return NextResponse.json({ items, source, lang });
  } catch (error) {
    if (error instanceof FoodSearchError) {
      console.error("[food-search-ai]", error.message);
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[food-search-ai]", error);
    return NextResponse.json({ error: "AI 搜尋失敗，請稍後再試" }, { status: 500 });
  }
}
