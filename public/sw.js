const CACHE_VERSION = "nutrition-coach-pwa-v6";
const STATIC_CACHE = "nutrition-coach-static-v6";

/** 只預快取唔會變嘅靜態檔，唔快取 HTML 頁面 */
const PRECACHE_URLS = ["/gorilla-logo.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept")?.includes("text/html"))
  );
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname === "/gorilla-logo.png" ||
    pathname === "/logo.png" ||
    pathname === "/manifest.json"
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML / 頁面導航：網絡優先，避免主畫面開到舊版空白頁
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Next 靜態資源：網絡優先，避免 PWA 長期使用舊版 JS
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 其他 GET（例如 RSC、API）：直接走網絡
  event.respondWith(fetch(event.request));
});

/** 收到伺服器推送（Web Push）時顯示系統通知 */
self.addEventListener("push", (event) => {
  const fallback = {
    title: "Nutrition Coach 提醒",
    body: "💧 記得飲水，或者去記錄你嘅飲食！",
    url: "/",
    tag: "nutrition-coach-reminder",
  };

  let payload = fallback;
  if (event.data) {
    try {
      payload = { ...fallback, ...event.data.json() };
    } catch {
      payload = { ...fallback, body: event.data.text() || fallback.body };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/gorilla-logo.png",
      badge: "/gorilla-logo.png",
      tag: payload.tag || "nutrition-coach-reminder",
      renotify: true,
      data: { url: payload.url || "/" },
    })
  );
});

/** 用戶撳通知時打開 App 對應頁面 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
