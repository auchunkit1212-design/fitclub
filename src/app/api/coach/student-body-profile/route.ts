import { NextResponse } from "next/server";
import { authorizeCoachForStudent } from "@/lib/coach-student-auth";
import { fetchStudentBodyProfile } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const studentEmail =
    new URL(request.url).searchParams.get("studentEmail")?.trim() ?? "";
  if (!studentEmail) {
    return NextResponse.json({ error: "缺少學員 Email" }, { status: 400 });
  }

  const auth = await authorizeCoachForStudent(session, studentEmail);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const profile = await fetchStudentBodyProfile(auth.student.email);
  return NextResponse.json({ profile });
}
