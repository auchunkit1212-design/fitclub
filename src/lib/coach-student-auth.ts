import { fetchAllUsers, filterStudentsForSession } from "@/lib/db";
import type { RegistryUser, UserSession } from "@/lib/types";

export async function authorizeCoachForStudent(
  session: UserSession,
  studentEmail: string
): Promise<
  | { ok: true; student: RegistryUser }
  | { ok: false; status: number; error: string }
> {
  if (session.role !== "coach" && session.role !== "admin") {
    return { ok: false, status: 403, error: "僅教練可操作" };
  }

  const email = studentEmail.trim().toLowerCase();
  if (!email) {
    return { ok: false, status: 400, error: "缺少學員 Email" };
  }

  const registry = await fetchAllUsers();
  const students = filterStudentsForSession(session, registry);
  const student = students.find((s) => s.email.trim().toLowerCase() === email);

  if (!student) {
    return { ok: false, status: 403, error: "無權限提醒此學員" };
  }

  return { ok: true, student };
}
