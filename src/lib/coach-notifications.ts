import { sendPushToEmails } from "@/lib/push-server";

export interface CoachMealNudgeResult {
  sent: number;
  failed: number;
}

export async function notifyStudentOfCoachMealNudge(input: {
  studentEmail: string;
  studentName: string;
  coachName: string;
  message?: string;
  todayMealCount?: number;
}): Promise<CoachMealNudgeResult> {
  const coachName = input.coachName.trim() || "教練";

  const defaultBody =
    input.todayMealCount === 0
      ? `${coachName} 教練提醒你：今日仲未記錄飲食，快打開 App 打卡！💧 記得飲水。`
      : `${coachName} 教練提醒你：今日已記 ${input.todayMealCount} 餐，請繼續補記同飲水，保持完整打卡！`;

  const body = input.message?.trim() || defaultBody;

  const stamp = Date.now();

  return sendPushToEmails([input.studentEmail.trim().toLowerCase()], {
    title: `📣 ${coachName} 提醒你要記錄`,
    body,
    url: "/add-meal",
    tag: `coach-nudge-${stamp}`,
  });
}
