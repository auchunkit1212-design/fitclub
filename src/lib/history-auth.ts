import { authorizeCoachForStudent } from "@/lib/coach-student-auth";
import type { UserSession } from "@/lib/types";

export async function resolveHistorySubjectEmail(
  session: UserSession,
  studentEmailParam: string | null | undefined
): Promise<
  | { ok: true; email: string }
  | { ok: false; status: number; error: string }
> {
  const requested = studentEmailParam?.trim().toLowerCase() ?? "";

  if (session.role === "student") {
    const self = session.email.trim().toLowerCase();
    if (requested && requested !== self) {
      return { ok: false, status: 403, error: "僅可查看自己的歷史紀錄" };
    }
    return { ok: true, email: self };
  }

  if (session.role === "coach" || session.role === "admin") {
    if (!requested) {
      return { ok: false, status: 400, error: "請指定學員 Email" };
    }
    const auth = await authorizeCoachForStudent(session, requested);
    if (!auth.ok) {
      return { ok: false, status: auth.status, error: auth.error };
    }
    return { ok: true, email: auth.student.email.trim().toLowerCase() };
  }

  return { ok: false, status: 403, error: "無權限查看歷史紀錄" };
}
