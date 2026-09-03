import { fetchAllUsers } from "@/lib/db";
import { DEFAULT_PERSONAL_SETTINGS } from "@/lib/personal-settings";
import { fetchTodayLogsForEmail } from "@/lib/phase4-db";
import {
  fetchReminderSettingsForEmails,
  markMorningPushSent,
  type StudentReminderSettings,
} from "@/lib/reminder-settings-db";
import {
  buildNightlyReminderPayload,
  fetchAllPushSubscriptions,
  getHongKongHour,
  NIGHTLY_REMINDER_HOUR_HKT,
  removeExpiredSubscriptions,
  type PushPayload,
  type PushSubscriptionRow,
} from "@/lib/push-server";
import webpush from "web-push";

/** 朝早提醒預設（學員可在 App 內自訂） */
export const DEFAULT_MORNING_REMINDER_TIME = "08:00";

function configureWebPush(): void {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || "mailto:auchunkit1212@gmail.com";
  if (!publicKey || !privateKey) {
    throw new Error("缺少 VAPID 公鑰或私鑰");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function getHongKongDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function sendOne(
  row: PushSubscriptionRow,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; expired: boolean }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 }
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : undefined;
    return { ok: false, expired: statusCode === 404 || statusCode === 410 };
  }
}

function getHongKongTimeHhMm(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parts.find((p) => p.type === "hour")?.value ?? "08";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function resolveSettings(
  email: string,
  map: Map<string, StudentReminderSettings>
): StudentReminderSettings {
  return (
    map.get(email) ?? {
      email,
      waterReminder: DEFAULT_PERSONAL_SETTINGS.waterReminder,
      mealSchedule: DEFAULT_PERSONAL_SETTINGS.mealSchedule,
      morningReminderTime: DEFAULT_PERSONAL_SETTINGS.morningReminderTime,
    }
  );
}

function buildMorningReminderPayload(
  breakfastLogged: boolean
): PushPayload {
  const mealHint = breakfastLogged
    ? "今日已記錄早餐，繼續保持！"
    : "記得記錄早餐同今日飲食。";
  return {
    title: "早晨提醒",
    body: `飲一大杯水先！${mealHint}`,
    url: "/add-meal",
    tag: `morning-${getHongKongDateKey()}`,
  };
}

export interface ScheduledReminderResult {
  hourHkt: number;
  timeHkt: string;
  dateHkt: string;
  subscriptionCount: number;
  morningSent: number;
  nightlySent: number;
  failed: number;
  removedExpired: number;
}

/** Cron：學員自訂朝早時間推播；22:00 HKT 每晚總結 */
export async function runScheduledStudentReminders(options?: {
  force?: boolean;
  slot?: "morning" | "nightly" | "all";
}): Promise<ScheduledReminderResult> {
  configureWebPush();
  const hourHkt = getHongKongHour();
  const timeHkt = getHongKongTimeHhMm();
  const dateHkt = getHongKongDateKey();
  const slot = options?.slot ?? "all";
  const sendMorning = options?.force || slot === "morning" || slot === "all";
  const sendNightly =
    options?.force ||
    slot === "nightly" ||
    (slot === "all" && hourHkt === NIGHTLY_REMINDER_HOUR_HKT);

  const subscriptions = await fetchAllPushSubscriptions();
  const allUsers = await fetchAllUsers();
  const studentEmails = new Set(
    allUsers
      .filter((u) => u.role === "student")
      .map((u) => u.email.trim().toLowerCase())
  );

  const subsByEmail = new Map<string, PushSubscriptionRow[]>();
  for (const sub of subscriptions) {
    const email = sub.email.trim().toLowerCase();
    if (!studentEmails.has(email)) continue;
    const list = subsByEmail.get(email) ?? [];
    list.push(sub);
    subsByEmail.set(email, list);
  }

  const settingsMap = await fetchReminderSettingsForEmails(
    Array.from(subsByEmail.keys())
  );

  let morningSent = 0;
  let nightlySent = 0;
  let failed = 0;
  const expiredIds: string[] = [];
  const mealCountCache = new Map<string, number>();

  for (const [email, subs] of Array.from(subsByEmail.entries())) {
    const settings = resolveSettings(email, settingsMap);

    if (sendMorning) {
      const dueNow =
        options?.force || settings.morningReminderTime === timeHkt;
      if (dueNow && settings.lastMorningPushKey !== dateHkt) {
        const logs = await fetchTodayLogsForEmail(email);
        const breakfastLogged = logs.some((log) =>
          /早餐|breakfast|morning/i.test(log.mealType)
        );
        const payload = buildMorningReminderPayload(breakfastLogged);
        let delivered = false;
        for (const sub of subs) {
          const result = await sendOne(sub, payload);
          if (result.ok) delivered = true;
          else {
            failed += 1;
            if (result.expired) expiredIds.push(sub.id);
          }
        }
        if (delivered) {
          morningSent += 1;
          await markMorningPushSent(email, dateHkt);
        }
      }
    }

    if (sendNightly) {
      let mealCount = mealCountCache.get(email);
      if (mealCount === undefined) {
        const logs = await fetchTodayLogsForEmail(email);
        mealCount = logs.length;
        mealCountCache.set(email, mealCount);
      }
      const payload = buildNightlyReminderPayload(mealCount);
      for (const sub of subs) {
        const result = await sendOne(sub, payload);
        if (result.ok) nightlySent += 1;
        else {
          failed += 1;
          if (result.expired) expiredIds.push(sub.id);
        }
      }
    }
  }

  const uniqueExpired = Array.from(new Set(expiredIds));
  await removeExpiredSubscriptions(uniqueExpired);

  return {
    hourHkt,
    timeHkt,
    dateHkt,
    subscriptionCount: subscriptions.length,
    morningSent,
    nightlySent,
    failed,
    removedExpired: uniqueExpired.length,
  };
}
