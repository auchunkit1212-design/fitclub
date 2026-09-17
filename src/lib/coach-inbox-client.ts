import {
  reviewLogIdsKey,
  writeReviewCache,
  writeStudentsCache,
} from "@/lib/coach-students-cache";
import { getSession, getSessionRequestHeaders } from "@/lib/session";
import { fetchWithTimeout } from "@/lib/with-timeout";
import type {
  MealLog,
  MealLogFeedback,
  MealLogReaction,
  RegistryUser,
} from "@/lib/types";

export type CoachInboxPayload = {
  registry: RegistryUser[];
  students: RegistryUser[];
  logs: MealLog[];
  unreviewed: MealLog[];
  reactions: MealLogReaction[];
  feedback: MealLogFeedback[];
};

export function applyCoachInboxToCache(
  email: string,
  data: CoachInboxPayload
): void {
  writeStudentsCache({
    email,
    registry: data.registry,
    logs: data.logs,
    students: data.students,
  });
  writeReviewCache({
    email,
    reactions: data.reactions,
    feedback: data.feedback,
    logIdsKey: reviewLogIdsKey(data.logs.map((log) => log.id)),
  });
}

export async function fetchCoachInbox(): Promise<CoachInboxPayload> {
  const res = await fetchWithTimeout("/api/coach/unreviewed-inbox", {
    credentials: "include",
    headers: getSessionRequestHeaders(),
  });
  if (!res.ok) {
    throw new Error("載入未檢閱飲食失敗");
  }
  return (await res.json()) as CoachInboxPayload;
}

export async function prefetchCoachInbox(): Promise<void> {
  const email = getSession()?.email;
  if (!email) return;
  try {
    const data = await fetchCoachInbox();
    applyCoachInboxToCache(email, data);
  } catch {
    // Prefetch is best-effort.
  }
}
