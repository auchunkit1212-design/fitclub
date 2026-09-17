import { NextResponse } from "next/server";
import { fetchReviewIndexForMealIds } from "@/lib/coach-review-index";
import {
  defaultMealLogsFromDate,
  fetchMealLogsForSession,
  fetchUsersForSession,
  filterStudentsForSession,
} from "@/lib/db";
import { filterUnreviewedMeals } from "@/lib/meal-review-status";
import { parseSessionFromRequest } from "@/lib/session-server";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (
    !session?.email ||
    (session.role !== "coach" && session.role !== "admin")
  ) {
    return NextResponse.json({ error: "僅教練可操作" }, { status: 403 });
  }

  const registry = await fetchUsersForSession(session);
  const students = filterStudentsForSession(session, registry);
  const logs = await fetchMealLogsForSession(session, registry, {
    from: defaultMealLogsFromDate(14),
  });
  const { reactions, feedback } = await fetchReviewIndexForMealIds(
    logs.map((log) => log.id)
  );
  const unreviewed = filterUnreviewedMeals(
    logs,
    session.email,
    reactions,
    feedback
  );

  return NextResponse.json({
    registry,
    students,
    logs,
    unreviewed,
    reactions,
    feedback,
  });
}
