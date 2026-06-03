import { getSessionRequestHeaders } from "@/lib/session";

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

/** 將訂閱存入後端（/api/notifications/subscribe → Supabase push_subscriptions） */
export async function savePushSubscriptionToServer(
  subscription: PushSubscription
): Promise<void> {
  const payload = subscriptionToPayload(subscription);

  const res = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getSessionRequestHeaders(),
    },
    credentials: "include",
    body: JSON.stringify({
      endpoint: payload.endpoint,
      keys: payload.keys,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    }),
  });

  const data = (await res.json()) as { error?: string; hint?: string };
  if (!res.ok) {
    throw new Error(data.error ?? data.hint ?? "訂閱儲存失敗");
  }
}

/** @deprecated 請改用 savePushSubscriptionToServer */
export const savePushSubscriptionToSupabase = savePushSubscriptionToServer;

/** 開發用：唔經伺服器，喺本機彈一個測試通知（App 開住時最易見到） */
export async function showLocalTestNotification(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("唔支援通知");
  }
  if (Notification.permission !== "granted") {
    throw new Error("請先開啟通知權限");
  }
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Nutrition Coach 測試", {
    body: "💧 飲水 / 🍽️ 記錄飲食提醒測試成功！",
    icon: "/gorilla-logo.png",
    badge: "/gorilla-logo.png",
    tag: "nutrition-coach-test",
    data: { url: "/add-meal" },
  });
}

