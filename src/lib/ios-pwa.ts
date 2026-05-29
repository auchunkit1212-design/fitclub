import { isStandaloneDisplay } from "@/lib/session";

/** iPhone / iPad 上用 Safari 開啟（未加入主畫面） */
export function isIosSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneDisplay()) return false;

  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  if (!isIos) return false;

  // 排除 iOS 上嘅 Chrome / Firefox / Edge 等
  const isOtherBrowser = /crios|fxios|edgios|opr\//i.test(ua);
  if (isOtherBrowser) return false;

  return /safari/i.test(ua);
}
