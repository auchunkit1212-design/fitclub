import { NextResponse } from "next/server";
import { generateAiNutritionTargets, type FitnessGoal } from "@/lib/ai-solo-coach";
import { fetchStudentBodyProfile } from "@/lib/db";
import { upsertStudentNutritionTargets } from "@/lib/phase4-db";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email || session.role !== "student") {
    return NextResponse.json({ error: "需要學員登入" }, { status: 401 });
  }

  let fitnessGoal: FitnessGoal = "maintain";
  try {
    const body = (await request.json()) as { fitnessGoal?: FitnessGoal };
    if (body.fitnessGoal === "cut" || body.fitnessGoal === "bulk" || body.fitnessGoal === "maintain") {
      fitnessGoal = body.fitnessGoal;
    }
  } catch {
    // default maintain
  }

  const profile = await fetchStudentBodyProfile(session.email);
  if (!profile) {
    return NextResponse.json({ error: "請先完成身體檔案設定" }, { status: 400 });
  }

  try {
    const targets = await generateAiNutritionTargets(
      profile,
      fitnessGoal,
      session.tenantId
    );
    const saved = await upsertStudentNutritionTargets(targets, {
      useServiceRole: true,
    });
    return NextResponse.json({ targets: saved, fitnessGoal });
  } catch (error) {
    console.error("[ai-targets]", error);
    return NextResponse.json({ error: "AI 聖旨生成失敗" }, { status: 500 });
  }
}
