"use client";

import { getSessionRequestHeaders } from "@/lib/session";
import { getStoredLanguage } from "@/lib/i18n";

export async function apiFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const sessionHeaders = getSessionRequestHeaders();
  for (const [k, v] of Object.entries(sessionHeaders)) {
    headers.set(k, v);
  }
  headers.set("x-wte-lang", getStoredLanguage());
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers, credentials: "include" });
}
