import { NextResponse } from "next/server";
import {
  diagnoseOpenRouter,
  getOpenRouterModel,
  isOpenRouterConfigured,
} from "@/lib/food-search/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 檢查 OpenRouter AI 食物聯想是否就緒 */
export async function GET() {
  const configured = isOpenRouterConfigured();
  const model = getOpenRouterModel();

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      model,
      source: "openrouter",
      message: "Set OPENROUTER_API_KEY in environment variables.",
    });
  }

  const diagnostics = await diagnoseOpenRouter();
  return NextResponse.json({
    source: "openrouter",
    ...diagnostics,
    message: diagnostics.ok
      ? `OpenRouter ready (${diagnostics.model}).`
      : diagnostics.error ?? "OpenRouter check failed.",
  });
}
