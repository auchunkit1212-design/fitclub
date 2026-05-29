import { getSupabaseAdmin } from "@/lib/supabase-admin";
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

export async function createTenantWithCoach(input: {
  email: string;
  passwordHash: string;
  gymName: string;
}): Promise<{ tenant: Tenant; coachEmail: string }> {
  const supabase = getSupabaseAdmin();
  const email = input.email.trim().toLowerCase();
  const slug = generateTenantSlug(input.gymName);

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
    name: input.gymName.trim(),
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

export async function syncTenantBranding(
  tenantId: string,
  payload: { gymName: string; logoUrl?: string }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tenants")
    .update({
      gym_name: payload.gymName,
      logo_url: payload.logoUrl ?? null,
    })
    .eq("id", tenantId);
  if (error) throw error;
}
