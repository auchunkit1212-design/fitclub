import { NextResponse } from "next/server";
import {
  fetchStudentBodyProfile,
  upsertStudentBodyProfile,
} from "@/lib/db";
import { authorizeStudentProfileUpdate } from "@/lib/student-profile-auth";
import {
  hasSessionCookie,
  parseSessionFromRequest,
} from "@/lib/session-server";
import type { StudentGender } from "@/lib/types";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  const auth = await authorizeStudentProfileUpdate(session, {
    cookiePresent: hasSessionCookie(request),
  });

  if (!auth.ok && auth.status === 401) {
    return NextResponse.json(
      { error: auth.error, code: auth.code, debug: auth.debug },
      { status: 401 }
    );
  }

  const email = auth.ok ? auth.email : session?.email;
  if (!email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const profile = await fetchStudentBodyProfile(email);
  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const session = parseSessionFromRequest(request);
  const body = (await request.json()) as {
    email?: string;
    heightCm?: number;
    weightKg?: number;
    age?: number;
    gender?: StudentGender;
    targetWeightKg?: number;
    exerciseCaloriesDaily?: number;
  };

  const auth = await authorizeStudentProfileUpdate(session, {
    cookiePresent: hasSessionCookie(request),
    bodyEmail: body.email,
  });

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
        code: auth.code,
        debug: auth.debug,
      },
      { status: auth.status }
    );
  }

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

  try {
    const profile = await upsertStudentBodyProfile(
      {
        email: auth.email,
        heightCm,
        weightKg,
        age,
        gender,
        targetWeightKg,
        exerciseCaloriesDaily: Number(body.exerciseCaloriesDaily) || 0,
        onboardingComplete: true,
      },
      { useServiceRole: true }
    );

    const response = NextResponse.json({
      profile,
      session: auth.session,
      savedToCloud: Boolean(profile.updatedAt),
    });

    response.cookies.set(
      "current_session",
      JSON.stringify(auth.session),
      {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      }
    );

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存失敗";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : undefined;
    return NextResponse.json(
      {
        error: message,
        code: code ?? "DB_ERROR",
        debug: auth.debug,
      },
      { status: 500 }
    );
  }
}
