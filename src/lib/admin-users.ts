import { fetchTenantById } from "@/lib/tenant";
import { isAiSoloTenantSlug } from "@/lib/ai-solo-coach";
import { hashPassword } from "@/lib/password";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import {
  getRegistryWriteClient,
  getSupabaseServiceRole,
} from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  password_plain?: string | null;
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
    adminPasswordPlain: row.password_plain?.trim() || null,
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
  passwordPlain: string | null;
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

  const passwordPlain =
    (row as RegistryRow).password_plain?.trim() ||
    user.adminPasswordPlain ||
    null;

  return {
    user: { ...user, adminPasswordPlain: passwordPlain },
    passwordPlain,
    tenant,
    bodyProfile,
    mealCount: meals.length,
    recentMeals,
  };
}

/** 總裁：重設用戶密碼並記錄明文供後台查看 */
export async function adminSetUserPassword(
  email: string,
  newPassword: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (normalized === SUPER_ADMIN_EMAIL) {
    throw new Error("無法重設總裁帳戶密碼。");
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error("密碼至少 6 位。");
  }

  const admin = getRegistryWriteClient();
  const passwordHash = await hashPassword(newPassword);
  const { data, error } = await admin
    .from("users_registry")
    .update({
      password_hash: passwordHash,
      password_plain: newPassword,
    })
    .eq("email", normalized)
    .select("email")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("找不到該帳戶。");
}

async function safeDeleteEq(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string
): Promise<void> {
  const { error } = await admin.from(table).delete().eq(column, value);
  if (error) {
    console.warn(`[admin-delete] ${table}.${column}:`, error.message);
  }
}

/** 一併刪除 Supabase Auth 用戶，避免日後以相同 Email 幽靈登入 */
async function deleteSupabaseAuthUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) {
        console.warn("[admin-delete] auth listUsers:", error.message);
        return;
      }
      const users = data?.users ?? [];
      const match = users.find(
        (u) => u.email?.trim().toLowerCase() === normalized
      );
      if (match) {
        const { error: delErr } = await admin.auth.admin.deleteUser(match.id);
        if (delErr) {
          console.warn("[admin-delete] auth deleteUser:", delErr.message);
        }
        return;
      }
      if (users.length < 200) break;
    }
  } catch (err) {
    console.warn("[admin-delete] auth cleanup skipped:", err);
  }
}

/** 總裁：刪除帳戶及相關資料（必須 Service Role，並驗證 registry 列已刪除） */
export async function adminDeleteUser(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (normalized === SUPER_ADMIN_EMAIL) {
    throw new Error("無法刪除總裁帳戶。");
  }

  let admin: SupabaseClient;
  try {
    admin = getSupabaseServiceRole();
  } catch {
    throw new Error(
      "缺少 SUPABASE_SERVICE_ROLE_KEY，無法永久刪除帳戶。請在 Vercel 設定 Service Role 後重試。"
    );
  }

  const { data: user, error: userErr } = await admin
    .from("users_registry")
    .select("email, role")
    .eq("email", normalized)
    .maybeSingle();

  if (userErr) throw userErr;
  if (!user) throw new Error("找不到該帳戶。");

  const { data: meals, error: mealsErr } = await admin
    .from("meal_logs")
    .select("id")
    .eq("email", normalized);
  if (mealsErr) throw mealsErr;

  const mealIds = (meals ?? []).map((m) => String(m.id));

  if (mealIds.length > 0) {
    const { error: reactErr } = await admin
      .from("meal_log_reactions")
      .delete()
      .in("meal_log_id", mealIds);
    if (reactErr) throw reactErr;

    const { error: mealDelErr } = await admin
      .from("meal_logs")
      .delete()
      .eq("email", normalized);
    if (mealDelErr) throw mealDelErr;
  }

  await Promise.all([
    safeDeleteEq(admin, "student_body_profiles", "email", normalized),
    safeDeleteEq(admin, "weight_logs", "email", normalized),
    safeDeleteEq(admin, "favorite_foods", "student_email", normalized),
    safeDeleteEq(admin, "student_nutrition_targets", "student_email", normalized),
    safeDeleteEq(admin, "push_subscriptions", "email", normalized),
    safeDeleteEq(admin, "student_reminder_settings", "email", normalized),
    safeDeleteEq(admin, "meal_log_reactions", "coach_email", normalized),
  ]);

  const { data: deletedRows, error: delErr } = await admin
    .from("users_registry")
    .delete()
    .eq("email", normalized)
    .select("email");

  if (delErr) throw delErr;
  if (!deletedRows?.length) {
    throw new Error(
      "刪除失敗：資料庫未移除該帳戶（可能權限不足）。請確認已設定 SUPABASE_SERVICE_ROLE_KEY。"
    );
  }

  await deleteSupabaseAuthUserByEmail(admin, normalized);
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
    throw new Error("資料庫更新失敗，請稍後再試或聯絡技術支援。");
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
