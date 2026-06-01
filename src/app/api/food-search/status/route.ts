import { NextResponse } from "next/server";
import { diagnoseFatSecret, isFatSecretConfigured } from "@/lib/food-search/fatsecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 檢查 FatSecret OAuth + 搜尋是否正常（部署除錯用） */
export async function GET() {
  const configured = isFatSecretConfigured();
  if (!configured) {
    return NextResponse.json({
      fatSecretConfigured: false,
      ok: false,
      message: "Set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET in environment variables.",
    });
  }

  const diagnostics = await diagnoseFatSecret();
  return NextResponse.json({
    fatSecretConfigured: true,
    ok: diagnostics.tokenOk && diagnostics.searchOk,
    ...diagnostics,
  });
}
