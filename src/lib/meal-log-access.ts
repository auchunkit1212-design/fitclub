import {
  fetchAllUsers,
  fetchMealLogById,
  filterStudentsForSession,
} from "@/lib/db";
import type { MealLog, UserSession } from "@/lib/types";

export { fetchMealLogById };

export async function assertCanEditMealLog(
  session: UserSession,
  log: MealLog
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const logEmail = log.email.trim().toLowerCase();
  const actorEmail = session.email.trim().toLowerCase();

  if (session.role === "admin") {
    return { ok: true };
  }

  if (session.role === "student") {
    if (logEmail === actorEmail) return { ok: true };
    return { ok: false, status: 403, error: "只能修改自己的飲食記錄" };
  }

  if (session.role === "coach") {
    const registry = await fetchAllUsers();
    const students = filterStudentsForSession(session, registry);
    const allowed = students.some(
      (s) => s.email.trim().toLowerCase() === logEmail
    );
    if (allowed) return { ok: true };
    return { ok: false, status: 403, error: "無權限修改此學員的記錄" };
  }

  return { ok: false, status: 403, error: "無權限" };
}
