import webpush from "web-push";
import { fetchTodayLogsForEmail } from "@/lib/phase4-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushSubscriptionRow {
  id: string;
  email: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** 每晚推播時段：香港時間 22:00（配合 Vercel Cron UTC 14:00） */
export const NIGHTLY_REMINDER_HOUR_HKT = 22;

export function getHongKongHour(): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hour);
}

export function buildNightlyReminderPayload(mealCountToday: number): PushPayload {
  if (mealCountToday > 0) {
    const calNote =
      mealCountToday >= 3
        ? "飲食記錄好完整"
        : mealCountToday >= 1
          ? "已有打卡"
          : "";
    return {
      title: "今日打卡總結",
      body: `🌙 你今天記錄了 ${mealCountToday} 餐${calNote ? `，${calNote}` : ""}。好好休息，聽日繼續加油！`,
      url: "/",
      tag: "nightly-summary",
    };
  }

  return {
    title: "明日溫馨提示",
    body: "🌅 聽日記得打開 App 記錄飲食，教練同 AI 會幫你跟進進度，晚安！",
    url: "/add-meal",
    tag: "nightly-tomorrow",
  };
}

/** 預覽用：僅在 22:00 HKT 回傳非空（實際發送為每位訂閱者個別內容） */
export function resolveRemindersForNow(): PushPayload[] {
  if (getHongKongHour() !== NIGHTLY_REMINDER_HOUR_HKT) return [];
  return [buildNightlyReminderPayload(0)];
}

function configureWebPush(): void {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || "mailto:auchunkit1212@gmail.com";

  if (!publicKey || !privateKey) {
    throw new Error("缺少 VAPID 公鑰或私鑰（NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY）");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function fetchAllPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, email, endpoint, p256dh, auth");

  if (error) throw error;
  return (data ?? []) as PushSubscriptionRow[];
}

async function sendOne(
  row: PushSubscriptionRow,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; statusCode?: number; expired: boolean }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 4 }
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : undefined;
    const expired = statusCode === 404 || statusCode === 410;
    return { ok: false, statusCode, expired };
  }
}

export async function removeExpiredSubscriptions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabaseAdmin();
  await supabase.from("push_subscriptions").delete().in("id", ids);
}

export interface CronSendResult {
  hourHkt: number;
  payloads: PushPayload[];
  subscriptionCount: number;
  sent: number;
  failed: number;
  removedExpired: number;
}

/** 每晚 22:00 HKT：依今日打卡數發送總結或明日溫馨提示（每位訂閱者個別內容） */
export async function runScheduledPushBroadcast(options?: {
  force?: boolean;
}): Promise<CronSendResult> {
  const hourHkt = getHongKongHour();

  if (!options?.force && hourHkt !== NIGHTLY_REMINDER_HOUR_HKT) {
    const subscriptions = await fetchAllPushSubscriptions();
    return {
      hourHkt,
      payloads: [],
      subscriptionCount: subscriptions.length,
      sent: 0,
      failed: 0,
      removedExpired: 0,
    };
  }

  configureWebPush();
  const subscriptions = await fetchAllPushSubscriptions();
  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];
  const payloadSamples: PushPayload[] = [];
  const mealCountCache = new Map<string, number>();

  for (const row of subscriptions) {
    const email = row.email.trim().toLowerCase();
    let mealCount = mealCountCache.get(email);
    if (mealCount === undefined) {
      const logs = await fetchTodayLogsForEmail(email);
      mealCount = logs.length;
      mealCountCache.set(email, mealCount);
    }

    const payload = buildNightlyReminderPayload(mealCount);
    if (payloadSamples.length < 2) payloadSamples.push(payload);

    const result = await sendOne(row, payload);
    if (result.ok) sent += 1;
    else {
      failed += 1;
      if (result.expired) expiredIds.push(row.id);
    }
  }

  const uniqueExpired = Array.from(new Set(expiredIds));
  await removeExpiredSubscriptions(uniqueExpired);

  return {
    hourHkt,
    payloads: payloadSamples,
    subscriptionCount: subscriptions.length,
    sent,
    failed,
    removedExpired: uniqueExpired.length,
  };
}

/** 手動測試：向所有訂閱發送一條測試通知 */
export async function fetchPushSubscriptionsForEmails(
  emails: string[]
): Promise<PushSubscriptionRow[]> {
  if (emails.length === 0) return [];
  const normalized = emails.map((e) => e.trim().toLowerCase());
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, email, endpoint, p256dh, auth")
    .in("email", normalized);

  if (error) throw error;
  return (data ?? []) as PushSubscriptionRow[];
}

/** 向指定電郵的訂閱發送單條通知 */
export async function sendPushToEmails(
  emails: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  configureWebPush();
  const subscriptions = await fetchPushSubscriptionsForEmails(emails);
  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  for (const row of subscriptions) {
    const result = await sendOne(row, payload);
    if (result.ok) sent += 1;
    else {
      failed += 1;
      if (result.expired) expiredIds.push(row.id);
    }
  }

  await removeExpiredSubscriptions(Array.from(new Set(expiredIds)));
  return { sent, failed };
}

export async function sendTestPushToAll(): Promise<CronSendResult> {
  configureWebPush();
  const payloads: PushPayload[] = [
    {
      title: "推送測試",
      body: "📲 推送測試成功！每晚 10 點提醒已就緒。",
      url: "/",
      tag: "nutrition-coach-test-push",
    },
  ];

  const subscriptions = await fetchAllPushSubscriptions();
  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  for (const row of subscriptions) {
    const result = await sendOne(row, payloads[0]);
    if (result.ok) sent += 1;
    else {
      failed += 1;
      if (result.expired) expiredIds.push(row.id);
    }
  }

  const uniqueExpired = Array.from(new Set(expiredIds));
  await removeExpiredSubscriptions(uniqueExpired);

  return {
    hourHkt: getHongKongHour(),
    payloads,
    subscriptionCount: subscriptions.length,
    sent,
    failed,
    removedExpired: uniqueExpired.length,
  };
}
