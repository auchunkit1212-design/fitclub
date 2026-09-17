import { NextResponse } from "next/server";
import {
  fetchFeedbackForMealIds,
  fetchReactionsForMealIds,
} from "@/lib/phase4-db";
import { parseSessionFromRequest } from "@/lib/session-server";

const CHUNK = 80;

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    chunks.push(ids.slice(i, i + CHUNK));
  }
  return chunks;
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { mealLogIds?: unknown };
  try {
    body = (await request.json()) as { mealLogIds?: unknown };
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const ids = Array.isArray(body.mealLogIds)
    ? body.mealLogIds
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .slice(0, 400)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ reactions: [], feedback: [] });
  }

  const chunks = chunkIds(ids);
  const batches = await Promise.all(
    chunks.map(async (chunk) => {
      const [reactions, feedback] = await Promise.all([
        fetchReactionsForMealIds(chunk),
        fetchFeedbackForMealIds(chunk),
      ]);
      return { reactions, feedback };
    })
  );

  return NextResponse.json({
    reactions: batches.flatMap((b) => b.reactions),
    feedback: batches.flatMap((b) => b.feedback),
  });
}
