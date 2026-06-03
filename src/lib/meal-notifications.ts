import { sendPushToEmails } from "@/lib/push-server";
import {
  findCoachForStudent,
  studentHasCoach,
} from "@/lib/phase4-db";
import { fetchUserByEmail } from "@/lib/db";
import type { MealLog } from "@/lib/types";

export async function notifyCoachOfNewMealLog(log: MealLog): Promise<void> {
  const student = await fetchUserByEmail(log.email);
  if (!student || !studentHasCoach(student)) return;

  const coach = await findCoachForStudent(log.email);
  if (!coach) return;

  const detail =
    log.description.length > 0
      ? `（${log.mealType} · ${log.calories} kcal）`
      : `（${log.calories} kcal）`;

  await sendPushToEmails([coach.email], {
    title: "學員打卡通知",
    body: `📢 學員 ${student.name} 剛上傳了新飲食紀錄，快去點評！${detail}`,
    url: "/coach",
    tag: `meal-log-${log.id}`,
  });
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
