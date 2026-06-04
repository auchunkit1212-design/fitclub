import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

let serviceRoleClient: SupabaseClient | null = null;

/** 登入／註冊寫入密碼必須用 Service Role（anon 可能讀不到 password_hash） */
export function getSupabaseServiceRole(): SupabaseClient {
  if (serviceRoleClient) return serviceRoleClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "缺少 SUPABASE_SERVICE_ROLE_KEY，學員註冊後無法以密碼登入。請在 Vercel 專案設定加入 Service Role。"
    );
  }

  serviceRoleClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceRoleClient;
}

/** 伺服器專用 Supabase（Cron / API）。優先用 Service Role，否則 fallback anon。 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;

  if (!url || !key) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 Supabase API Key（建議設定 SUPABASE_SERVICE_ROLE_KEY）"
    );
  }

  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
