import webpush from "web-push";
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

const MEAL_HOURS_HKT = new Set([8, 12, 19]);
const WATER_HOURS_HKT = new Set([8, 10, 12, 14, 16, 18, 20]);

function getHongKongHour(): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hour);
}

export function resolveRemindersForNow(): PushPayload[] {
  const hour = getHongKongHour();
  const payloads: PushPayload[] = [];

  if (WATER_HOURS_HKT.has(hour)) {
    payloads.push({
      title: "飲水提醒",
      body: "💧 飲水時間！記得補充水分，保持訓練狀態。",
      url: "/",
      tag: `water-${hour}`,
    });
  }

  if (MEAL_HOURS_HKT.has(hour)) {
    const copy =
      hour === 8
        ? { body: "🌅 早餐時間！記得記低你食咗咩。", tag: "meal-breakfast" }
        : hour === 12
          ? { body: "🍱 午餐時間！請打開 App 記錄飲食。", tag: "meal-lunch" }
          : { body: "🌙 晚餐時間！唔好忘記打卡記錄。", tag: "meal-dinner" };

    payloads.push({
      title: "飲食打卡提醒",
      body: copy.body,
      url: "/add-meal",
      tag: copy.tag,
    });
  }

  return payloads;
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

export async function runScheduledPushBroadcast(): Promise<CronSendResult> {
  configureWebPush();

  const payloads = resolveRemindersForNow();
  const hourHkt = getHongKongHour();

  if (payloads.length === 0) {
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

  const subscriptions = await fetchAllPushSubscriptions();
  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  for (const row of subscriptions) {
    for (const payload of payloads) {
      const result = await sendOne(row, payload);
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        if (result.expired) expiredIds.push(row.id);
      }
    }
  }

  const uniqueExpired = Array.from(new Set(expiredIds));
  await removeExpiredSubscriptions(uniqueExpired);

  return {
    hourHkt,
    payloads,
    subscriptionCount: subscriptions.length,
    sent,
    failed,
    removedExpired: uniqueExpired.length,
  };
}

/** 手動測試：向所有訂閱發送一條測試通知 */
export async function sendTestPushToAll(): Promise<CronSendResult> {
  configureWebPush();
  const payloads: PushPayload[] = [
    {
      title: "推送測試",
      body: "📲 推送測試成功！飲水同飲食提醒已就緒。",
      url: "/",
      tag: "fitclub-test-push",
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
