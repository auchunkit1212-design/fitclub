import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { RegistryUser } from "@/lib/types";
import { normalizeUserPlan } from "@/lib/user-plan";
import type { ThemeColor } from "@/lib/types";

type UserRow = {
  email: string;
  name: string;
  role: "student" | "coach";
  gym: string | null;
  coach: string | null;
  logo: string | null;
  added_by: string | null;
  app_title: string | null;
  theme_color: string | null;
  broadcast: string | null;
  tenant_id: string | null;
  plan?: string | null;
  avatar_url?: string | null;
};

function mapCoachRow(row: UserRow): RegistryUser {
  return {
    email: row.email,
    name: row.name,
    role: row.role,
    plan: normalizeUserPlan(row.plan),
    avatarUrl: row.avatar_url ?? null,
    gym: row.gym ?? "",
    coach: row.coach ?? undefined,
    addedBy: row.added_by ?? undefined,
    tenantId: row.tenant_id ?? undefined,
    logo: row.logo ?? undefined,
    appTitle: row.app_title ?? undefined,
    themeColor: (row.theme_color as ThemeColor) ?? undefined,
    broadcast: row.broadcast ?? undefined,
    hasPassword: false,
  };
}

export async function fetchCoachByName(
  coachName: string
): Promise<RegistryUser | null> {
  const trimmed = coachName.trim();
  if (!trimmed) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("users_registry")
    .select("*")
    .eq("role", "coach")
    .eq("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCoachRow(data as UserRow) : null;
}

export async function fetchCoachByTenantId(
  tenantId: string
): Promise<RegistryUser | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("users_registry")
    .select("*")
    .eq("role", "coach")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCoachRow(data as UserRow) : null;
}
