import { sendPushToEmails } from "@/lib/push-server";

export interface CoachMealNudgeResult {
  sent: number;
  failed: number;
}

export type CoachBulkNudgeResult = {
  total: number;
  sentStudents: number;
  failedDeliveries: number;
  noSubscription: number;
  studentNames: string[];
};

export async function notifyCoachStudentsBulk(input: {
  students: { email: string; name: string; todayMealCount?: number }[];
  coachName: string;
}): Promise<CoachBulkNudgeResult> {
  const coachName = input.coachName.trim() || "教練";
  let sentStudents = 0;
  let failedDeliveries = 0;
  let noSubscription = 0;
  const studentNames: string[] = [];

  for (const student of input.students) {
    const result = await notifyStudentOfCoachMealNudge({
      studentEmail: student.email,
      studentName: student.name,
      coachName,
      todayMealCount: student.todayMealCount ?? 0,
    });

    if (result.sent > 0) {
      sentStudents += 1;
      studentNames.push(student.name);
    } else {
      noSubscription += 1;
    }
    failedDeliveries += result.failed;
  }

  return {
    total: input.students.length,
    sentStudents,
    failedDeliveries,
    noSubscription,
    studentNames,
  };
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
      ? `${coachName} 教練提醒你：今日仲未記錄飲食，快打開 App 打卡！記得飲水。`
      : `${coachName} 教練提醒你：今日已記 ${input.todayMealCount} 餐，請繼續補記同飲水，保持完整打卡！`;

  const body = input.message?.trim() || defaultBody;

  const stamp = Date.now();

  return sendPushToEmails([input.studentEmail.trim().toLowerCase()], {
    title: `${coachName} 提醒你要記錄`,
    body,
    url: "/add-meal",
    tag: `coach-nudge-${stamp}`,
  });
}
