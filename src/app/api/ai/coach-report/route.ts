import { NextResponse } from "next/server";
import { generateAiCoachReport } from "@/lib/ai-feedback";
import { normalizeLanguage } from "@/lib/i18n";
import { parseSessionFromRequest } from "@/lib/session-server";
import type { MealLog } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function readMacro(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function parseLogs(value: unknown): MealLog[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const m = row as Record<string, unknown>;
      const description = String(m.description ?? "").trim();
      const mealType = String(m.mealType ?? "").trim() || "餐食";
      if (!description) return null;
      return {
        id: String(m.id ?? ""),
        email: String(m.email ?? ""),
        date: String(m.date ?? ""),
        mealType,
        description,
        calories: readMacro(m.calories),
        protein: readMacro(m.protein),
        carbs: readMacro(m.carbs),
        fats: readMacro(m.fats),
        createdAt: String(m.createdAt ?? ""),
      } satisfies MealLog;
    })
    .filter((m): m is MealLog => m !== null);
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  if (session.role !== "coach" && session.role !== "admin") {
    return NextResponse.json({ error: "僅教練或 Admin 可用" }, { status: 403 });
  }

  const body = (await request.json()) as {
    logs?: unknown;
    lang?: string;
    gymName?: string;
    studentName?: string;
  };

  const logs = parseLogs(body.logs);
  const lang = normalizeLanguage(body.lang);
  const studentName =
    typeof body.studentName === "string" ? body.studentName.trim() : undefined;

  try {
    const result = await generateAiCoachReport({
      logs,
      lang,
      gymName:
        typeof body.gymName === "string"
          ? body.gymName.trim()
          : session.gym,
      studentName: studentName || undefined,
    });

    return NextResponse.json({
      report: result.text,
      source: result.source,
    });
  } catch (err) {
    console.error("[api/ai/coach-report]", err);
    return NextResponse.json({ error: "AI 報告暫時不可用" }, { status: 502 });
  }
}
