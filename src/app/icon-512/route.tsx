import { createNutritionCoachIcon } from "@/lib/pwa-icon";

export const runtime = "edge";

export async function GET() {
  return createNutritionCoachIcon(512);
}
