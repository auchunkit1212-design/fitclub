import { NextResponse } from "next/server";
import { isFatSecretConfigured } from "@/lib/food-search/fatsecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 檢查 FatSecret 是否已在伺服器環境變數中設定（部署後用於除錯） */
export async function GET() {
  return NextResponse.json({
    fatSecretConfigured: isFatSecretConfigured(),
  });
}
