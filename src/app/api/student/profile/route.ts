import { NextResponse } from "next/server";
import {
  fetchStudentBodyProfile,
  upsertStudentBodyProfile,
} from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";
import type { StudentGender } from "@/lib/types";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const profile = await fetchStudentBodyProfile(session.email);
  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email || session.role !== "student") {
    return NextResponse.json({ error: "僅學員可更新" }, { status: 403 });
  }

  const body = (await request.json()) as {
    heightCm?: number;
    weightKg?: number;
    age?: number;
    gender?: StudentGender;
    targetWeightKg?: number;
    exerciseCaloriesDaily?: number;
  };

  const heightCm = Number(body.heightCm);
  const weightKg = Number(body.weightKg);
  const age = Number(body.age);
  const targetWeightKg = Number(body.targetWeightKg);
  const gender = body.gender;

  if (
    !heightCm ||
    !weightKg ||
    !age ||
    !targetWeightKg ||
    !gender ||
    !["male", "female", "other"].includes(gender)
  ) {
    return NextResponse.json({ error: "請填寫完整身體數據" }, { status: 400 });
  }

  const profile = await upsertStudentBodyProfile({
    email: session.email,
    heightCm,
    weightKg,
    age,
    gender,
    targetWeightKg,
    exerciseCaloriesDaily: Number(body.exerciseCaloriesDaily) || 0,
    onboardingComplete: true,
  });

  return NextResponse.json({ profile });
}
