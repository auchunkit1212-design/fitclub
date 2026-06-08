import { fetchTenantById } from "@/lib/tenant";
import { isAiSoloTenantSlug } from "@/lib/ai-solo-coach";
import { hashPassword } from "@/lib/password";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import {
  getRegistryWriteClient,
  getSupabaseServiceRole,
} from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RegistryUser,
  StudentBodyProfile,
  Tenant,
  ThemeColor,
  UserPlan,
} from "@/lib/types";
import { fetchMealLogs, fetchStudentBodyProfile } from "@/lib/db";

function requireServiceRoleAdmin(): SupabaseClient {
  try {
    return getSupabaseServiceRole();
  } catch {
    throw new Error(
      "缺少 SUPABASE_SERVICE_ROLE_KEY，無法執行總裁後台寫入。請在 Vercel 設定 Service Role 後重試。"
    );
  }
}

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
  logo?: string | null;
  app_title?: string | null;
  theme_color?: string | null;
  broadcast?: string | null;
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
    logo: row.logo ?? undefined,
    appTitle: row.app_title ?? undefined,
    themeColor: (row.theme_color as ThemeColor) ?? undefined,
    broadcast: row.broadcast ?? undefined,
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

  const admin = requireServiceRoleAdmin();
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
  const admin = requireServiceRoleAdmin();
  const { data, error } = await admin
    .from("users_registry")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data as RegistryRow[]).map((row) => mapRegistryRow(row));
  return attachTenantNamesAdmin(rows);
}

export async function fetchAllTenantsAdmin(): Promise<Tenant[]> {
  const admin = requireServiceRoleAdmin();
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

export type AdminUserUpdateInput = {
  email: string;
  name?: string;
  role?: "student" | "coach";
  gym?: string;
  tenantId?: string | null;
  coach?: string | null;
  addedBy?: string | null;
  plan?: UserPlan;
  appTitle?: string | null;
  themeColor?: ThemeColor | null;
  logo?: string | null;
  broadcast?: string | null;
  avatarUrl?: string | null;
  currentStreak?: number;
  longestStreak?: number;
  /** 教練綁定 tenant 時同步更新 tenants.owner_email */
  syncTenantOwner?: boolean;
};

async function resolveStudentCoachFieldsForTenant(
  tenant: Tenant
): Promise<{ addedBy: string | null; coachName: string | null }> {
  const isSolo = isAiSoloTenantSlug(tenant.slug);
  if (isSolo) {
    return { addedBy: null, coachName: null };
  }

  const admin = requireServiceRoleAdmin();
  const ownerEmail = tenant.ownerEmail.trim().toLowerCase();
  const { data: coachRow } = await admin
    .from("users_registry")
    .select("name, email")
    .eq("email", ownerEmail)
    .eq("role", "coach")
    .maybeSingle();

  if (coachRow?.name) {
    return {
      addedBy: ownerEmail,
      coachName: String(coachRow.name),
    };
  }

  const { data: tenantCoachRows } = await admin
    .from("users_registry")
    .select("name, email")
    .eq("role", "coach")
    .eq("tenant_id", tenant.id)
    .limit(1);

  const tenantCoach = tenantCoachRows?.[0];
  if (tenantCoach?.email) {
    return {
      addedBy: String(tenantCoach.email).trim().toLowerCase(),
      coachName: tenantCoach.name ? String(tenantCoach.name) : null,
    };
  }

  return {
    addedBy: ownerEmail,
    coachName: null,
  };
}

/** 總裁：更新帳戶資料（含角色 coach ↔ student） */
export async function adminUpdateUser(
  input: AdminUserUpdateInput
): Promise<RegistryUser> {
  const normalized = input.email.trim().toLowerCase();
  if (normalized === SUPER_ADMIN_EMAIL) {
    throw new Error("無法修改總裁帳戶。");
  }

  const admin = requireServiceRoleAdmin();
  const tenantAssignment = input.tenantId !== undefined;

  const { data: existing, error: fetchErr } = await admin
    .from("users_registry")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error("找不到該帳戶。");

  const row = existing as RegistryRow;
  const patch: Record<string, unknown> = {};
  const nextRole = input.role ?? row.role;

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("姓名不可為空。");
    patch.name = name;
  }

  if (input.plan !== undefined) {
    patch.plan = input.plan === "pro" ? "pro" : "free";
  }

  if (!tenantAssignment && input.gym !== undefined) {
    patch.gym = input.gym.trim();
  }

  if (input.avatarUrl !== undefined) {
    patch.avatar_url = input.avatarUrl?.trim() || null;
  }

  if (input.currentStreak !== undefined) {
    patch.current_streak = Math.max(0, Math.round(input.currentStreak));
  }

  if (input.longestStreak !== undefined) {
    patch.longest_streak = Math.max(0, Math.round(input.longestStreak));
  }

  if (input.role !== undefined) {
    if (input.role !== "student" && input.role !== "coach") {
      throw new Error("角色必須為 student 或 coach。");
    }
    patch.role = input.role;

    if (input.role === "student" && row.role === "coach") {
      patch.logo = null;
      patch.app_title = null;
      patch.theme_color = null;
      patch.broadcast = null;
    }

    if (input.role === "coach" && row.role === "student") {
      patch.added_by = null;
      patch.coach = null;
      if (input.appTitle === undefined && !row.app_title) {
        patch.app_title =
          (input.gym ?? row.gym ?? row.name)?.trim() || row.name;
      }
      if (input.themeColor === undefined && !row.theme_color) {
        patch.theme_color = "emerald";
      }
    }
  }

  if (tenantAssignment) {
    const tenantId = input.tenantId?.trim() || null;
    if (tenantId) {
      const tenant = await fetchTenantById(tenantId);
      if (!tenant) throw new Error("找不到該健身室／品牌空間。");

      patch.tenant_id = tenant.id;
      patch.gym = tenant.gymName;

      if (nextRole === "student") {
        const { addedBy, coachName } =
          await resolveStudentCoachFieldsForTenant(tenant);
        patch.added_by = addedBy;
        patch.coach = coachName;
      }

      if (nextRole === "coach" && input.syncTenantOwner !== false) {
        const { error: ownerErr } = await admin
          .from("tenants")
          .update({ owner_email: normalized })
          .eq("id", tenant.id);
        if (ownerErr) {
          console.warn("[admin-update] tenant owner sync:", ownerErr.message);
        }
      }
    } else {
      patch.tenant_id = null;
    }
  }

  if (nextRole === "student" && !tenantAssignment) {
    if (input.coach !== undefined) {
      patch.coach = input.coach?.trim() || null;
    }
    if (input.addedBy !== undefined) {
      patch.added_by = input.addedBy?.trim().toLowerCase() || null;
    }
  }

  if (nextRole === "coach") {
    if (input.appTitle !== undefined) {
      patch.app_title = input.appTitle?.trim() || null;
    }
    if (input.themeColor !== undefined) {
      patch.theme_color = input.themeColor;
    }
    if (input.logo !== undefined) {
      patch.logo = input.logo?.trim() || null;
    }
    if (input.broadcast !== undefined) {
      patch.broadcast = input.broadcast?.trim() || null;
    }
  }

  if (Object.keys(patch).length === 0) {
    const [unchanged] = await attachTenantNamesAdmin([mapRegistryRow(row)]);
    return unchanged;
  }

  const { data: updatedRow, error: updateErr } = await admin
    .from("users_registry")
    .update(patch)
    .eq("email", normalized)
    .select("*")
    .maybeSingle();

  if (updateErr) throw updateErr;
  if (!updatedRow) throw new Error("資料庫更新失敗，請稍後再試。");

  if (tenantAssignment && input.tenantId?.trim() && nextRole === "student") {
    const { error: targetsErr } = await admin
      .from("student_nutrition_targets")
      .update({ tenant_id: input.tenantId.trim() })
      .eq("student_email", normalized);
    if (targetsErr) {
      console.warn("[admin-update] student_nutrition_targets:", targetsErr.message);
    }
  }

  const [user] = await attachTenantNamesAdmin([
    mapRegistryRow(updatedRow as RegistryRow),
  ]);
  return user;
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

  const admin = requireServiceRoleAdmin();
  const { data: userRow, error: userErr } = await admin
    .from("users_registry")
    .select("email, role, tenant_id")
    .eq("email", normalized)
    .maybeSingle();

  if (userErr) throw userErr;
  if (!userRow) {
    throw new Error("找不到該帳號。");
  }

  const previousTenantId = userRow.tenant_id
    ? String(userRow.tenant_id)
    : null;
  if (previousTenantId === tenant.id) {
    const { data: full, error: readErr } = await admin
      .from("users_registry")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!full) throw new Error("找不到該帳號。");
    const [unchanged] = await attachTenantNamesAdmin([
      mapRegistryRow(full as RegistryRow),
    ]);
    return { ...unchanged, tenantName: tenant.gymName };
  }

  return adminUpdateUser({
    email: normalized,
    tenantId: tenant.id,
    gym: tenant.gymName,
    role: userRow.role === "coach" ? "coach" : "student",
    syncTenantOwner: userRow.role === "coach",
  });
}

export type AdminTenantSummary = Tenant & {
  ownerName?: string;
  coachCount: number;
  studentCount: number;
};

/** 總裁：已登記健身室列表（含成員統計） */
export async function fetchTenantsAdminSummary(): Promise<AdminTenantSummary[]> {
  const [tenants, users] = await Promise.all([
    fetchAllTenantsAdmin(),
    fetchAllUsersAdmin(),
  ]);

  return tenants.map((tenant) => {
    const affiliated = users.filter((u) => u.tenantId === tenant.id);
    const owner = affiliated.find(
      (u) => u.email.toLowerCase() === tenant.ownerEmail.toLowerCase()
    );
    return {
      ...tenant,
      ownerName: owner?.name,
      coachCount: affiliated.filter((u) => u.role === "coach").length,
      studentCount: affiliated.filter((u) => u.role === "student").length,
    };
  });
}

/** 總裁：刪除健身室／品牌 Tenant（含教練帳戶；學員解除綁定） */
export async function adminDeleteTenant(tenantId: string): Promise<void> {
  const tenant = await fetchTenantById(tenantId.trim());
  if (!tenant) throw new Error("找不到該健身室。");
  if (isAiSoloTenantSlug(tenant.slug)) {
    throw new Error("無法刪除系統 AI 散客健身室。");
  }

  const admin = requireServiceRoleAdmin();

  const { data: affiliated, error: affErr } = await admin
    .from("users_registry")
    .select("email, role")
    .eq("tenant_id", tenant.id);

  if (affErr) throw affErr;

  const coachEmails = Array.from(
    new Set(
      (affiliated ?? [])
        .filter((row) => row.role === "coach")
        .map((row) => String(row.email).trim().toLowerCase())
        .concat(tenant.ownerEmail.trim().toLowerCase())
    )
  );

  const { error: unlinkStudentsErr } = await admin
    .from("users_registry")
    .update({
      tenant_id: null,
      gym: "未綁定分店",
      coach: null,
      added_by: null,
    })
    .eq("tenant_id", tenant.id)
    .eq("role", "student");

  if (unlinkStudentsErr) throw unlinkStudentsErr;

  const { error: unlinkCoachesErr } = await admin
    .from("users_registry")
    .update({ tenant_id: null })
    .eq("tenant_id", tenant.id)
    .eq("role", "coach");

  if (unlinkCoachesErr) throw unlinkCoachesErr;

  await safeDeleteEq(admin, "community_posts", "tenant_id", tenant.id);
  await safeDeleteEq(admin, "student_nutrition_targets", "tenant_id", tenant.id);

  const { data: deleted, error: delErr } = await admin
    .from("tenants")
    .delete()
    .eq("id", tenant.id)
    .select("id");

  if (delErr) throw delErr;
  if (!deleted?.length) {
    throw new Error("刪除健身室失敗，請確認 Service Role 權限。");
  }

  const stillThere = await fetchTenantById(tenant.id);
  if (stillThere) {
    throw new Error("刪除後健身室仍存在，請稍後再試或檢查資料庫權限。");
  }

  for (const email of coachEmails) {
    if (email === SUPER_ADMIN_EMAIL) continue;
    try {
      await adminDeleteUser(email);
    } catch (err) {
      console.warn(`[admin-delete-tenant] coach ${email}:`, err);
    }
  }
}
