import { fetchTenantById } from "@/lib/tenant";
import { isAiSoloTenantSlug } from "@/lib/ai-solo-coach";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import type { RegistryUser, StudentBodyProfile, Tenant } from "@/lib/types";
import {
  fetchAllUsers,
  fetchMealLogs,
  fetchStudentBodyProfile,
  fetchUserByEmail,
} from "@/lib/db";

export async function fetchAllUsersAdmin(): Promise<RegistryUser[]> {
  return fetchAllUsers();
}

export async function fetchAllTenantsAdmin(): Promise<Tenant[]> {
  let admin;
  try {
    admin = getSupabaseServiceRole();
  } catch {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin");
    admin = getSupabaseAdmin();
  }
  const { data, error } = await admin
    .from("tenants")
    .select("*")
    .order("gym_name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    gymName: String(row.gym_name),
    logoUrl: row.logo_url ? String(row.logo_url) : undefined,
    ownerEmail: String(row.owner_email),
    plan: String(row.plan ?? "trial"),
  }));
}

export type AdminUserProfileDetail = {
  user: RegistryUser;
  tenant: Tenant | null;
  bodyProfile: StudentBodyProfile | null;
  mealCount: number;
  recentMeals: { id: string; mealType: string; description: string; calories: number; createdAt: string }[];
};

export async function fetchAdminUserProfile(
  email: string
): Promise<AdminUserProfileDetail | null> {
  const normalized = email.trim().toLowerCase();
  const [user, bodyProfile, meals] = await Promise.all([
    fetchUserByEmail(normalized),
    fetchStudentBodyProfile(normalized),
    fetchMealLogs({ emails: [normalized] }),
  ]);

  if (!user) return null;
  let tenant: Tenant | null = null;
  if (user.tenantId) {
    tenant = await fetchTenantById(user.tenantId);
  }

  const recentMeals = meals.slice(0, 8).map((m) => ({
    id: m.id,
    mealType: m.mealType,
    description: m.description,
    calories: m.calories,
    createdAt: m.createdAt,
  }));

  return {
    user,
    tenant,
    bodyProfile,
    mealCount: meals.length,
    recentMeals,
  };
}

/** 總裁：將學員／散客調到指定健身室 Tenant */
export async function adminReassignStudentToTenant(
  studentEmail: string,
  tenantId: string
): Promise<RegistryUser> {
  const normalized = studentEmail.trim().toLowerCase();
  const tenant = await fetchTenantById(tenantId);
  if (!tenant) {
    throw new Error("找不到該健身室／品牌空間。");
  }

  const admin = getSupabaseServiceRole();
  const { data: student, error: studentErr } = await admin
    .from("users_registry")
    .select("*")
    .eq("email", normalized)
    .eq("role", "student")
    .maybeSingle();

  if (studentErr) throw studentErr;
  if (!student) {
    throw new Error("找不到該學員帳號。");
  }

  const isSolo = isAiSoloTenantSlug(tenant.slug);
  let coachName: string | null = null;

  if (!isSolo) {
    const { data: coachRow } = await admin
      .from("users_registry")
      .select("name")
      .eq("email", tenant.ownerEmail)
      .eq("role", "coach")
      .maybeSingle();
    coachName = coachRow?.name ? String(coachRow.name) : null;
  }

  const { error: updateErr } = await admin
    .from("users_registry")
    .update({
      tenant_id: tenant.id,
      gym: tenant.gymName,
      added_by: isSolo ? null : tenant.ownerEmail,
      coach: coachName,
    })
    .eq("email", normalized);

  if (updateErr) throw updateErr;

  const updated = await fetchAdminUserProfile(normalized);
  if (!updated) throw new Error("更新後讀取失敗");
  return updated.user;
}
