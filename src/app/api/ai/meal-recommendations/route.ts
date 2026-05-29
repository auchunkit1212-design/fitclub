import { NextResponse } from "next/server";
import {
  buildQuotaMealRecommendations,
  enhanceRecommendationsWithAi,
} from "@/lib/ai-coach";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    remainingCalories?: number;
    remainingProtein?: number;
    remainingCarbs?: number;
    remainingFats?: number;
  };

  const remainingCalories = Number(body.remainingCalories) || 0;
  const remainingProtein = Number(body.remainingProtein) || 0;
  const remainingCarbs = Number(body.remainingCarbs) || 0;
  const remainingFats = Number(body.remainingFats) || 0;

  const base = buildQuotaMealRecommendations(
    remainingCalories,
    remainingProtein,
    remainingCarbs,
    remainingFats
  );

  const context = `剩餘：${remainingCalories} kcal，蛋白 ${remainingProtein}g，碳水 ${remainingCarbs}g，脂肪 ${remainingFats}g`;
  const recommendations = await enhanceRecommendationsWithAi(base, context);

  return NextResponse.json({ recommendations });
}
