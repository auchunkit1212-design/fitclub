import { NextResponse } from "next/server";
import {
  emailExists,
  fetchAllUsers,
  insertUser,
} from "@/lib/db";
import { checkCoachStudentLimit } from "@/lib/user-plan";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  if (session.role !== "coach" && session.role !== "admin") {
    return NextResponse.json({ error: "僅教練可新增學員" }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: string;
    name?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";

  if (!email || !name) {
    return NextResponse.json({ error: "請填寫學員姓名同 Email" }, { status: 400 });
  }

  const registry = await fetchAllUsers();
  const limit = checkCoachStudentLimit(session, registry);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: limit.error,
        code: "STUDENT_LIMIT_REACHED",
        limit: limit.limit,
        current: limit.current,
      },
      { status: 403 }
    );
  }

  if (await emailExists(email)) {
    return NextResponse.json({ error: "該 Email 已經登記過" }, { status: 409 });
  }

  try {
    await insertUser(
      {
        email,
        name,
        role: "student",
        gym: session.brandName ?? session.gym,
        coach: session.name,
        addedBy: session.email,
        tenantId: session.tenantId,
      },
      session
    );
    return NextResponse.json({
      ok: true,
      email,
      name,
      studentCount: limit.current + 1,
      limit: limit.limit,
    });
  } catch (error) {
    console.error("[coach/students] insert failed:", error);
    return NextResponse.json({ error: "雲端寫入失敗" }, { status: 500 });
  }
}
