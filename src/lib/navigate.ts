import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** iOS 主畫面 PWA 有時 router.replace 唔跳轉，用 location 做後備 */
export function goTo(router: AppRouterInstance, path: string) {
  router.replace(path);
  if (typeof window === "undefined") return;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  if (!standalone) return;
  window.setTimeout(() => {
    if (window.location.pathname !== path) {
      window.location.assign(path);
    }
  }, 400);
}
