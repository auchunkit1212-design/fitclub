import { fetchTenantById } from "@/lib/tenant";
import { isAiSoloTenantSlug } from "@/lib/ai-solo-coach";
import { getRegistryWriteClient } from "@/lib/supabase-admin";
import type { RegistryUser, StudentBodyProfile, Tenant } from "@/lib/types";
import { fetchMealLogs, fetchStudentBodyProfile } from "@/lib/db";

type RegistryRow = {
  email: string;
  name: string;
  role: "student" | "coach";
  gym: string | null;
  coach: string | null;
  added_by: string | null;
  tenant_id: string | null;
  plan?: string | null;
  avatar_url?: string | null;
  current_streak?: number | null;
  longest_streak?: number | null;
  password_hash?: string | null;
};

function mapRegistryRow(row: RegistryRow): RegistryUser {
  return {
    email: row.email,
    name: row.name,
    role: row.role,
    plan: row.plan === "pro" ? "pro" : "free",
    avatarUrl: row.avatar_url ?? null,
    gym: row.gym ?? "",
    coach: row.coach ?? undefined,
    addedBy: row.added_by ?? undefined,
    tenantId: row.tenant_id ?? undefined,
    hasPassword: Boolean(row.password_hash),
    currentStreak: Number(row.current_streak) || 0,
    longestStreak: Number(row.longest_streak) || 0,
  };
}

async function attachTenantNamesAdmin(
  users: RegistryUser[]
): Promise<RegistryUser[]> {
  const tenantIds = users
    .map((u) => u.tenantId)
    .filter((id): id is string => Boolean(id));
  if (tenantIds.length === 0) return users;

  const admin = getRegistryWriteClient();
  const unique = Array.from(new Set(tenantIds));
  const { data, error } = await admin
    .from("tenants")
    .select("id, gym_name")
    .in("id", unique);

  if (error) {
    console.warn("[admin-users] tenant names:", error.message);
    return users;
  }

  const names = new Map(
    (data ?? []).map((row) => [String(row.id), String(row.gym_name)])
  );
  return users.map((u) => ({
    ...u,
    tenantName: u.tenantId ? names.get(u.tenantId) ?? u.gym : undefined,
  }));
}

export async function fetchAllUsersAdmin(): Promise<RegistryUser[]> {
  const admin = getRegistryWriteClient();
  const { data, error } = await admin
    .from("users_registry")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data as RegistryRow[]).map((row) => mapRegistryRow(row));
  return attachTenantNamesAdmin(rows);
}

export async function fetchAllTenantsAdmin(): Promise<Tenant[]> {
  const admin = getRegistryWriteClient();
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
  recentMeals: {
    id: string;
    mealType: string;
    description: string;
    calories: number;
    createdAt: string;
  }[];
};

export async function fetchAdminUserProfile(
  email: string
): Promise<AdminUserProfileDetail | null> {
  const normalized = email.trim().toLowerCase();
  const admin = getRegistryWriteClient();
  const { data: row, error } = await admin
    .from("users_registry")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const [user] = await attachTenantNamesAdmin([
    mapRegistryRow(row as RegistryRow),
  ]);

  const [bodyProfile, meals] = await Promise.all([
    fetchStudentBodyProfile(normalized),
    fetchMealLogs({ emails: [normalized] }),
  ]);

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

  const admin = getRegistryWriteClient();
  const { data: student, error: studentErr } = await admin
    .from("users_registry")
    .select("email, role, tenant_id")
    .eq("email", normalized)
    .eq("role", "student")
    .maybeSingle();

  if (studentErr) throw studentErr;
  if (!student) {
    throw new Error("找不到該學員帳號。");
  }

  const previousTenantId = student.tenant_id
    ? String(student.tenant_id)
    : null;
  if (previousTenantId === tenant.id) {
    const { data: full, error: readErr } = await admin
      .from("users_registry")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!full) throw new Error("找不到該學員帳號。");
    const [unchanged] = await attachTenantNamesAdmin([
      mapRegistryRow(full as RegistryRow),
    ]);
    return { ...unchanged, tenantName: tenant.gymName };
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

  const { data: updatedRow, error: updateErr } = await admin
    .from("users_registry")
    .update({
      tenant_id: tenant.id,
      gym: tenant.gymName,
      added_by: isSolo ? null : tenant.ownerEmail,
      coach: coachName,
    })
    .eq("email", normalized)
    .eq("role", "student")
    .select("*")
    .maybeSingle();

  if (updateErr) throw updateErr;
  if (!updatedRow) {
    throw new Error(
      "資料庫更新失敗。請確認已設定 SUPABASE_SERVICE_ROLE_KEY，或聯絡技術支援。"
    );
  }

  const [user] = await attachTenantNamesAdmin([
    mapRegistryRow(updatedRow as RegistryRow),
  ]);
  return {
    ...user,
    tenantName: tenant.gymName,
    gym: tenant.gymName,
    tenantId: tenant.id,
    coach: coachName ?? undefined,
    addedBy: isSolo ? undefined : tenant.ownerEmail,
  };
}
