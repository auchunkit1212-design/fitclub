import { NextResponse } from "next/server";
import {
  fetchFavoriteFoods,
  upsertFavoriteFood,
} from "@/lib/phase4-db";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const favorites = await fetchFavoriteFoods(session.email);
  return NextResponse.json({ favorites });
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name: string;
    brand?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    servingLabel?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "缺少食物名稱" }, { status: 400 });
  }

  const favorite = await upsertFavoriteFood({
    studentEmail: session.email,
    name: body.name.trim(),
    brand: body.brand ?? "",
    calories: Number(body.calories) || 0,
    protein: Number(body.protein) || 0,
    carbs: Number(body.carbs) || 0,
    fats: Number(body.fats) || 0,
    servingLabel: body.servingLabel ?? "1 份",
    useCount: 1,
  });

  return NextResponse.json({ favorite });
}
