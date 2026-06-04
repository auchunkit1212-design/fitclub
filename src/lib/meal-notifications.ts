import { isAiSoloTenantSlug } from "@/lib/ai-solo-coach";
import { fetchUserByEmail } from "@/lib/db";
import {
  findCoachesForStudent,
  studentHasCoach,
} from "@/lib/phase4-db";
import { sendPushToEmails } from "@/lib/push-server";
import { fetchTenantById } from "@/lib/tenant";
import type { MealLog } from "@/lib/types";

export interface CoachMealNotifyResult {
  skipped: boolean;
  reason?: string;
  coachEmails: string[];
  sent: number;
  failed: number;
}

async function shouldNotifyCoachForStudent(
  studentEmail: string
): Promise<{ notify: boolean; reason?: string }> {
  const student = await fetchUserByEmail(studentEmail);
  if (!student) {
    return { notify: false, reason: "student_not_found" };
  }

  if (student.tenantId) {
    const tenant = await fetchTenantById(student.tenantId);
    if (tenant && isAiSoloTenantSlug(tenant.slug)) {
      return { notify: false, reason: "solo_student" };
    }
  }

  if (!studentHasCoach(student)) {
    return { notify: false, reason: "no_coach" };
  }

  return { notify: true };
}

export async function notifyCoachOfNewMealLog(
  log: MealLog
): Promise<CoachMealNotifyResult> {
  const gate = await shouldNotifyCoachForStudent(log.email);
  if (!gate.notify) {
    return {
      skipped: true,
      reason: gate.reason,
      coachEmails: [],
      sent: 0,
      failed: 0,
    };
  }

  const coaches = await findCoachesForStudent(log.email);
  if (coaches.length === 0) {
    console.warn("[meal-notifications] no coach resolved for", log.email);
    return {
      skipped: true,
      reason: "coach_not_resolved",
      coachEmails: [],
      sent: 0,
      failed: 0,
    };
  }

  const student = await fetchUserByEmail(log.email);
  const studentName = student?.name ?? log.email;
  const coachEmails = coaches.map((c) => c.email.trim().toLowerCase());
  const detail =
    log.description.length > 0
      ? `（${log.mealType} · ${log.calories} kcal）`
      : `（${log.calories} kcal）`;

  const { sent, failed } = await sendPushToEmails(coachEmails, {
    title: "學員打卡通知",
    body: `📢 學員 ${studentName} 剛上傳了新飲食紀錄，快去點評！${detail}`,
    url: "/coach",
    tag: `meal-log-${log.id}`,
  });

  if (sent === 0) {
    console.warn(
      "[meal-notifications] coach push not delivered; coaches may not have enabled notifications:",
      coachEmails
    );
  }

  return {
    skipped: false,
    coachEmails,
    sent,
    failed,
  };
}

export async function notifyStudentOfReaction(
  studentEmail: string,
  sticker: string,
  coachName: string
): Promise<void> {
  await sendPushToEmails([studentEmail], {
    title: "教練回覆咗你嘅餐單",
    body: `${coachName} 送咗你 ${sticker}`,
    url: "/",
    tag: `reaction-${Date.now()}`,
  });
}
