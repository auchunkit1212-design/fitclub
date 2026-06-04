import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  AI_GORILLA_COACH_EMAIL,
  AI_SOLO_TENANT_NAME,
  AI_SOLO_TENANT_SLUG,
} from "@/lib/registry-constants";
import type { Tenant } from "@/lib/types";

type TenantRow = {
  id: string;
  slug: string;
  gym_name: string;
  logo_url: string | null;
  owner_email: string;
  plan: string;
  created_at: string;
};

function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    gymName: row.gym_name,
    logoUrl: row.logo_url ?? undefined,
    ownerEmail: row.owner_email,
    plan: row.plan,
  };
}

export function generateTenantSlug(gymName: string): string {
  const ascii = gymName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);
  const base = ascii || "gym";
  return `${base}-${Date.now().toString(36).slice(-6)}`;
}

export async function fetchTenantById(id: string): Promise<Tenant | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTenant(data as TenantRow) : null;
}

export async function fetchTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTenant(data as TenantRow) : null;
}

/** 學員註冊邀請碼：先比對 slug，再 fallback 至 tenant id */
export async function fetchTenantByInviteCode(
  code: string
): Promise<Tenant | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const bySlug = await fetchTenantBySlug(trimmed);
  if (bySlug) return bySlug;
  return fetchTenantById(trimmed);
}

/** 教練發布品牌時：若尚未綁定 Tenant，自動建立並連結邀請碼（slug） */
export async function ensureCoachTenant(input: {
  coachEmail: string;
  gymName: string;
  coachName?: string;
}): Promise<Tenant> {
  const supabase = getSupabaseAdmin();
  const email = input.coachEmail.trim().toLowerCase();
  const gymName = input.gymName.trim() || "Nutrition Coach";

  const { data: coachRow, error: coachErr } = await supabase
    .from("users_registry")
    .select("email, name, tenant_id")
    .eq("email", email)
    .eq("role", "coach")
    .maybeSingle();

  if (coachErr) throw coachErr;
  if (!coachRow) {
    throw new Error("找不到教練帳號，請確認已用教練身份登入。");
  }

  if (coachRow.tenant_id) {
    const existing = await fetchTenantById(String(coachRow.tenant_id));
    if (existing) return existing;
  }

  const slug = generateTenantSlug(gymName);
  const coachName =
    input.coachName?.trim() || String(coachRow.name ?? "").trim() || gymName;

  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      slug,
      gym_name: gymName,
      owner_email: email,
      plan: "trial",
    })
    .select("*")
    .single();

  if (tenantError) throw tenantError;
  const tenant = mapTenant(tenantRow as TenantRow);

  const { error: linkError } = await supabase
    .from("users_registry")
    .update({
      tenant_id: tenant.id,
      gym: gymName,
      name: coachName,
    })
    .eq("email", email)
    .eq("role", "coach");

  if (linkError) throw linkError;

  return tenant;
}

export async function createTenantWithCoach(input: {
  email: string;
  passwordHash: string;
  gymName: string;
  coachName?: string;
}): Promise<{ tenant: Tenant; coachEmail: string }> {
  const supabase = getSupabaseAdmin();
  const email = input.email.trim().toLowerCase();
  const slug = generateTenantSlug(input.gymName);
  const coachName = input.coachName?.trim() || input.gymName.trim();

  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      slug,
      gym_name: input.gymName.trim(),
      owner_email: email,
      plan: "trial",
    })
    .select("*")
    .single();

  if (tenantError) throw tenantError;
  const tenant = mapTenant(tenantRow as TenantRow);

  const { error: coachError } = await supabase.from("users_registry").insert({
    email,
    name: coachName,
    role: "coach",
    gym: input.gymName.trim(),
    tenant_id: tenant.id,
    added_by: email,
    app_title: input.gymName.trim(),
    theme_color: "emerald",
    password_hash: input.passwordHash,
  });

  if (coachError) throw coachError;

  return { tenant, coachEmail: email };
}

/** 取得或建立散客 AI 私教 Tenant（#003） */
export async function ensureAiSoloTenant(): Promise<Tenant> {
  const existing = await fetchTenantBySlug(AI_SOLO_TENANT_SLUG);
  if (existing) return existing;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      slug: AI_SOLO_TENANT_SLUG,
      gym_name: AI_SOLO_TENANT_NAME,
      owner_email: AI_GORILLA_COACH_EMAIL,
      plan: "b2c",
      theme_color: "emerald",
    })
    .select("*")
    .single();

  if (error) {
    const retry = await fetchTenantBySlug(AI_SOLO_TENANT_SLUG);
    if (retry) return retry;
    throw error;
  }
  return mapTenant(data as TenantRow);
}

export async function createPartnerTenantWithCoach(input: {
  brandName: string;
  coachEmail: string;
  coachName: string;
  addedByAdminEmail: string;
}): Promise<{ tenant: Tenant; coachEmail: string }> {
  const supabase = getSupabaseAdmin();
  const brandName = input.brandName.trim();
  const email = input.coachEmail.trim().toLowerCase();
  const coachName = input.coachName.trim();
  const slug = generateTenantSlug(brandName);

  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      slug,
      gym_name: brandName,
      owner_email: email,
      plan: "trial",
    })
    .select("*")
    .single();

  if (tenantError) throw tenantError;
  const tenant = mapTenant(tenantRow as TenantRow);

  const { error: coachError } = await supabase.from("users_registry").insert({
    email,
    name: coachName,
    role: "coach",
    gym: brandName,
    tenant_id: tenant.id,
    added_by: input.addedByAdminEmail.trim().toLowerCase(),
    app_title: brandName,
    theme_color: "emerald",
  });

  if (coachError) throw coachError;

  return { tenant, coachEmail: email };
}

export async function fetchTenantNamesByIds(
  ids: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, gym_name")
    .in("id", unique);

  if (error) throw error;
  return new Map((data ?? []).map((row) => [String(row.id), String(row.gym_name)]));
}

export async function syncTenantBranding(
  tenantId: string,
  payload: { gymName: string; logoUrl?: string; themeColor?: string }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const update: Record<string, string | null> = {
    gym_name: payload.gymName,
    logo_url: payload.logoUrl ?? null,
  };
  if (payload.themeColor) {
    update.theme_color = payload.themeColor;
  }
  const { error } = await supabase.from("tenants").update(update).eq("id", tenantId);
  if (error) throw error;
}
