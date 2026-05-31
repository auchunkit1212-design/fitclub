"use client";

import { useEffect } from "react";

/** 將 PWA manifest 指向動態 API，登入後自動套用品牌 */
export function DynamicManifestLink() {
  useEffect(() => {
    const href = "/api/manifest";
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) {
      link.setAttribute("href", href);
    }
  }, []);

  return null;
}
