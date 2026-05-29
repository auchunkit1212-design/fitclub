import { getSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export type PushPermissionState = NotificationPermission | "unsupported";

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushPermission(): PushPermissionState {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export function subscriptionToPayload(
  subscription: PushSubscription
): PushSubscriptionPayload {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("PushSubscription 資料不完整");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh, auth },
  };
}

/** 向用戶請求權限並建立 PushSubscription（需要 NEXT_PUBLIC_VAPID_PUBLIC_KEY） */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error("此瀏覽器或裝置唔支援 Web Push");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("你未允許通知權限");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("缺少 NEXT_PUBLIC_VAPID_PUBLIC_KEY，請喺 Vercel 設定 VAPID 公鑰");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        vapidPublicKey
      ) as BufferSource,
    });
  }

  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}

/** 將訂閱 JSON 存入 Supabase（需先執行 supabase/push_subscriptions.sql） */
export async function savePushSubscriptionToSupabase(
  subscription: PushSubscription
): Promise<void> {
  const session = getSession();
  if (!session?.email) {
    throw new Error("請先登入再開啟推送");
  }

  const payload = subscriptionToPayload(subscription);

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      email: session.email.trim().toLowerCase(),
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) throw error;
}

/** 開發用：唔經伺服器，喺本機彈一個測試通知（App 開住時最易見到） */
export async function showLocalTestNotification(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("唔支援通知");
  }
  if (Notification.permission !== "granted") {
    throw new Error("請先開啟通知權限");
  }
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("FitClub 測試", {
    body: "💧 飲水 / 🍽️ 記錄飲食提醒測試成功！",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: "fitclub-test",
    data: { url: "/add-meal" },
  });
}

