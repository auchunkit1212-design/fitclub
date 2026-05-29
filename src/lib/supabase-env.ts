/** 檢查前端可見的 Supabase 環境變數（NEXT_PUBLIC_* 在 build 時注入） */
export function getSupabasePublicEnvStatus(): {
  ok: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  urlPreview?: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const hasUrl = url.length > 0;
  const hasAnonKey = anonKey.length > 0;
  return {
    ok: hasUrl && hasAnonKey,
    hasUrl,
    hasAnonKey,
    urlPreview: hasUrl ? url.replace(/https?:\/\//, "").slice(0, 40) : undefined,
  };
}
