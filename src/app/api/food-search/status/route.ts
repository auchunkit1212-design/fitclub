import { NextResponse } from "next/server";
import {
  diagnoseOpenRouter,
  getOpenRouterKeyHint,
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
    keyHint: getOpenRouterKeyHint(),
    ...diagnostics,
    message: diagnostics.ok
      ? `OpenRouter ready (${diagnostics.model}, ${diagnostics.sampleCount ?? 0} sample items).`
      : diagnostics.hint
        ? `${diagnostics.error ?? "OpenRouter check failed."} — ${diagnostics.hint}`
        : diagnostics.error ?? "OpenRouter check failed.",
  });
}
