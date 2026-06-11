import { fetchUsersForSession } from "@/lib/db";
import { getSessionRequestHeaders } from "@/lib/session";
import type { RegistryUser, UserSession } from "@/lib/types";

/** 總裁用 Service Role API 讀取，避免客戶端 Supabase 快取／延遲 */
export async function fetchRegistryForSession(
  session: UserSession
): Promise<RegistryUser[]> {
  if (session.role === "admin") {
    try {
      const res = await fetch(`/api/admin/accounts?_=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
        headers: getSessionRequestHeaders(),
      });
      const data = (await res.json()) as { users?: RegistryUser[]; error?: string };
      if (res.ok && data.users) return data.users;
      console.warn("[registry-client] admin accounts:", data.error);
    } catch (err) {
      console.warn("[registry-client] admin accounts fetch failed:", err);
    }
  }
  return fetchUsersForSession(session);
}
