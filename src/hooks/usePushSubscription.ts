"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPushPermission,
  isPushSupported,
  savePushSubscriptionToServer,
  showLocalTestNotification,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-notifications";

export type PushSubscriptionStatus =
  | "idle"
  | "loading"
  | "enabled"
  | "denied"
  | "error"
  | "unsupported";

export function usePushSubscription() {
  const [status, setStatus] = useState<PushSubscriptionStatus>("idle");
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<string>("default");

  const refresh = useCallback(async () => {
    const ok = isPushSupported();
    setSupported(ok);
    if (!ok) {
      setStatus("unsupported");
      return;
    }
    setPermission(getPushPermission());
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "enabled" : "idle");
    } catch {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    setStatus("loading");
    setMessage("");
    try {
      const subscription = await subscribeToPush();
      await savePushSubscriptionToServer(subscription);
      setStatus("enabled");
      setPermission("granted");
      return { ok: true };
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "開啟推播失敗";
      setStatus(
        text.includes("未允許") || text.toLowerCase().includes("denied")
          ? "denied"
          : "error"
      );
      setMessage(text);
      setPermission(getPushPermission());
      return { ok: false, error: text };
    }
  }, []);

  const disable = useCallback(async () => {
    setStatus("loading");
    try {
      await unsubscribeFromPush();
      setStatus("idle");
      await refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "關閉失敗");
      setStatus("error");
      return false;
    }
  }, [refresh]);

  const testLocal = useCallback(async () => {
    try {
      await showLocalTestNotification();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "測試失敗");
      return false;
    }
  }, []);

  return {
    status,
    message,
    setMessage,
    supported,
    permission,
    refresh,
    enable,
    disable,
    testLocal,
  };
}
