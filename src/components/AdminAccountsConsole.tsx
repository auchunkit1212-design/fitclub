"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CircleUser,
  IconLabel,
  Loader2,
  Search,
  Trash2,
  Users,
} from "@/components/icons";
import { AI_SOLO_TENANT_SLUG } from "@/lib/registry-constants";
import { getSessionRequestHeaders } from "@/lib/session";
import type { AdminUserProfileDetail } from "@/lib/admin-users";
import type { RegistryUser, Tenant } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type RoleFilter = "all" | "student" | "coach";

type Props = {
  registry: RegistryUser[];
  onRegistryChange: (users: RegistryUser[]) => void;
  onToast: (message: string) => void;
};

function gymLabel(user: RegistryUser): string {
  return user.tenantName ?? user.gym ?? "—";
}

function roleBadge(role: RegistryUser["role"]) {
  if (role === "coach") {
    return (
      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
        教練
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
      學員
    </span>
  );
}

export function AdminAccountsConsole({
  registry,
  onRegistryChange,
  onToast,
}: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(registry.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onRegistryChangeRef = useRef(onRegistryChange);
  const onToastRef = useRef(onToast);
  const registryRef = useRef(registry);

  useEffect(() => {
    onRegistryChangeRef.current = onRegistryChange;
    onToastRef.current = onToast;
    registryRef.current = registry;
  });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminUserProfileDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [assignTenantId, setAssignTenantId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadAccounts = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      const data = (await res.json()) as {
        users?: RegistryUser[];
        tenants?: Tenant[];
        error?: string;
      };
      if (!res.ok) {
        const msg = data.error ?? "讀取帳戶失敗";
        setLoadError(msg);
        onToastRef.current(msg);
        return;
      }
      if (data.users) onRegistryChangeRef.current(data.users);
      if (data.tenants) setTenants(data.tenants);
    } catch {
      const msg = "無法連線讀取帳戶";
      setLoadError(msg);
      onToastRef.current(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts({ silent: registry.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registry.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        gymLabel(u).toLowerCase().includes(q)
      );
    });
  }, [registry, search, roleFilter]);

  const openProfile = async (email: string) => {
    setSelectedEmail(email);
    setProfile(null);
    setProfileLoading(true);
    setAssignTenantId("");
    try {
      const res = await fetch(
        `/api/admin/users/profile?email=${encodeURIComponent(email)}`,
        { credentials: "include", headers: getSessionRequestHeaders() }
      );
      const data = (await res.json()) as AdminUserProfileDetail & {
        error?: string;
      };
      if (!res.ok) {
        onToast(data.error ?? "讀取 profile 失敗");
        setSelectedEmail(null);
        return;
      }
      setProfile(data);
      setAssignTenantId(data.user.tenantId ?? "");
    } catch {
      onToast("讀取 profile 失敗");
      setSelectedEmail(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setSelectedEmail(null);
    setProfile(null);
    setAssignTenantId("");
    setResetPassword("");
  };

  const handleResetPassword = async () => {
    if (!profile || resetPassword.length < 6) {
      onToastRef.current("請輸入至少 6 位新密碼");
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch("/api/admin/users/password", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        body: JSON.stringify({
          email: profile.user.email,
          password: resetPassword,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onToastRef.current(data.error ?? "重設密碼失敗");
        return;
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              passwordPlain: resetPassword,
              user: {
                ...prev.user,
                adminPasswordPlain: resetPassword,
                hasPassword: true,
              },
            }
          : prev
      );
      onRegistryChangeRef.current(
        registryRef.current.map((u) =>
          u.email.toLowerCase() === profile.user.email.toLowerCase()
            ? {
                ...u,
                adminPasswordPlain: resetPassword,
                hasPassword: true,
              }
            : u
        )
      );
      setResetPassword("");
      onToastRef.current("密碼已重設");
    } catch {
      onToastRef.current("重設密碼失敗");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile) return;
    const ok = window.confirm(
      `確定永久刪除「${profile.user.name}」（${profile.user.email}）？\n此操作無法復原，相關飲食記錄亦會一併刪除。`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/users/delete?email=${encodeURIComponent(profile.user.email)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: getSessionRequestHeaders(),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onToastRef.current(data.error ?? "刪除失敗");
        return;
      }
      onRegistryChangeRef.current(
        registryRef.current.filter(
          (u) => u.email.toLowerCase() !== profile.user.email.toLowerCase()
        )
      );
      onToastRef.current(`已刪除 ${profile.user.email}`);
      closeProfile();
      void loadAccounts({ silent: true });
    } catch {
      onToastRef.current("刪除失敗");
    } finally {
      setDeleting(false);
    }
  };

  const handleAssign = async () => {
    if (!profile || profile.user.role !== "student") return;
    if (!assignTenantId) {
      onToastRef.current("請選擇目標健身室");
      return;
    }
    const targetTenant = tenants.find((t) => t.id === assignTenantId);
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/users/assign-tenant", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        body: JSON.stringify({
          email: profile.user.email,
          tenantId: assignTenantId,
        }),
      });
      const data = (await res.json()) as {
        user?: RegistryUser;
        unchanged?: boolean;
        error?: string;
      };
      if (!res.ok) {
        onToastRef.current(data.error ?? "調配失敗");
        return;
      }

      const nextUser: RegistryUser = data.user
        ? {
            ...data.user,
            tenantName: targetTenant?.gymName ?? data.user.tenantName ?? data.user.gym,
            gym: targetTenant?.gymName ?? data.user.gym,
            tenantId: assignTenantId,
          }
        : profile.user;

      onRegistryChangeRef.current(
        registryRef.current.map((u) =>
          u.email.toLowerCase() === nextUser.email.toLowerCase() ? nextUser : u
        )
      );

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              user: nextUser,
              tenant: targetTenant ?? prev.tenant,
            }
          : prev
      );

      onToastRef.current(
        data.unchanged
          ? `該學員已在「${targetTenant?.gymName ?? nextUser.gym}」，無需調配`
          : `已調至「${targetTenant?.gymName ?? nextUser.gym}」`
      );
      void loadAccounts({ silent: true });
    } catch {
      onToastRef.current("調配失敗，請檢查網絡或稍後再試");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-zinc-900 border-l-4 border-zinc-900 pl-2">
            <IconLabel icon={Users} iconClassName="text-zinc-700">
              全平台帳戶 ({registry.length})
            </IconLabel>
          </h2>
          <button
            type="button"
            onClick={() => void loadAccounts()}
            disabled={loading}
            className={`text-xs font-semibold text-zinc-600 underline ${btnClass}`}
          >
            重新整理
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          撳姓名查看 profile（含密碼）；學員可調健身室；可重設密碼或刪除帳戶。
        </p>

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋姓名、Email、健身室…"
            className="w-full rounded-xl border border-zinc-200 pl-9 pr-3 py-2.5 text-sm"
          />
        </div>

        <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
          {(
            [
              ["all", "全部"],
              ["student", "學員"],
              ["coach", "教練"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRoleFilter(key)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold ${btnClass} ${
                roleFilter === key
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loadError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {loadError}
          </p>
        )}

        {loading && registry.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" aria-hidden />
            載入帳戶中…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">沒有符合的帳戶</p>
        ) : (
          <ul className="space-y-2 max-h-[min(420px,50vh)] overflow-y-auto">
            {filtered.map((user) => (
              <li key={user.email}>
                <button
                  type="button"
                  onClick={() => void openProfile(user.email)}
                  className={`w-full text-left p-3 rounded-xl border border-zinc-100 bg-zinc-50 hover:bg-emerald-50 hover:border-emerald-200 ${btnClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-zinc-900 truncate">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>
                    {roleBadge(user.role)}
                  </div>
                  <p className="text-xs text-emerald-800 mt-2 truncate flex items-center gap-1">
                    <Building2 size={12} className="shrink-0" aria-hidden />
                    {gymLabel(user)}
                  </p>
                  {user.role === "student" && user.coach && (
                    <p className="text-[10px] text-zinc-500 mt-1 truncate">
                      教練：{user.coach}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-600 mt-1.5 font-mono truncate">
                    密碼：{user.adminPasswordPlain ?? "（未記錄明文）"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedEmail && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-profile-title"
        >
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
              <h3
                id="admin-profile-title"
                className="font-bold text-zinc-900 flex items-center gap-2"
              >
                <CircleUser size={20} className="text-emerald-600" aria-hidden />
                帳戶 Profile
              </h3>
              <button
                type="button"
                onClick={closeProfile}
                className={`p-2 rounded-full hover:bg-zinc-100 ${btnClass}`}
                aria-label="關閉"
              >
                <span className="text-xl leading-none" aria-hidden>
                  ×
                </span>
              </button>
            </div>

            {profileLoading || !profile ? (
              <div className="p-8 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin" aria-hidden />
                載入 profile…
              </div>
            ) : (
              <div className="p-4 space-y-4 pb-8">
                <div>
                  <p className="text-lg font-bold text-zinc-900">{profile.user.name}</p>
                  <p className="text-sm font-mono text-zinc-500 mt-0.5">
                    {profile.user.email}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {roleBadge(profile.user.role)}
                    {profile.user.hasPassword ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                        已設密碼
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        未設密碼
                      </span>
                    )}
                    {profile.user.plan === "pro" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                        Pro
                      </span>
                    )}
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-zinc-50 rounded-xl p-3">
                    <dt className="text-zinc-500">健身室／品牌</dt>
                    <dd className="font-semibold text-zinc-900 mt-1">
                      {gymLabel(profile.user)}
                    </dd>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-3">
                    <dt className="text-zinc-500">飲食記錄</dt>
                    <dd className="font-semibold text-zinc-900 mt-1">
                      {profile.mealCount} 筆
                    </dd>
                  </div>
                  {profile.user.role === "student" && (
                    <>
                      <div className="bg-zinc-50 rounded-xl p-3">
                        <dt className="text-zinc-500">負責教練</dt>
                        <dd className="font-semibold text-zinc-900 mt-1 truncate">
                          {profile.user.coach ?? "—"}
                        </dd>
                      </div>
                      <div className="bg-zinc-50 rounded-xl p-3">
                        <dt className="text-zinc-500">連續打卡</dt>
                        <dd className="font-semibold text-zinc-900 mt-1">
                          {profile.user.currentStreak ?? 0} 天
                        </dd>
                      </div>
                    </>
                  )}
                  {profile.tenant && (
                    <div className="col-span-2 bg-zinc-50 rounded-xl p-3">
                      <dt className="text-zinc-500">邀請碼 (slug)</dt>
                      <dd className="font-mono text-zinc-800 mt-1 text-[11px]">
                        {profile.tenant.slug}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                  <p className="text-xs font-bold text-zinc-800">登入密碼</p>
                  <p className="font-mono text-sm text-zinc-900 break-all">
                    {profile.passwordPlain ?? "（未記錄明文 — 舊帳戶或註冊前建立）"}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="重設新密碼（至少 6 位）"
                      className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono"
                    />
                    <button
                      type="button"
                      disabled={resettingPassword || resetPassword.length < 6}
                      onClick={() => void handleResetPassword()}
                      className={`shrink-0 px-3 py-2 rounded-xl bg-zinc-800 text-white text-xs font-bold disabled:opacity-50 ${btnClass}`}
                    >
                      {resettingPassword ? "…" : "重設"}
                    </button>
                  </div>
                </div>

                {profile.bodyProfile && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs space-y-1">
                    <p className="font-bold text-emerald-900">身體檔案</p>
                    <p>
                      {profile.bodyProfile.heightCm}cm · {profile.bodyProfile.weightKg}
                      kg · {profile.bodyProfile.age}歲 · 目標{" "}
                      {profile.bodyProfile.targetWeightKg}kg
                    </p>
                  </div>
                )}

                {profile.recentMeals.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-zinc-700 mb-2">最近飲食</p>
                    <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                      {profile.recentMeals.map((m) => (
                        <li
                          key={m.id}
                          className="text-[11px] bg-zinc-50 rounded-lg px-2.5 py-2 flex justify-between gap-2"
                        >
                          <span className="truncate">
                            {m.mealType} · {m.description}
                          </span>
                          <span className="shrink-0 font-semibold text-emerald-700">
                            {m.calories} kcal
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {profile.user.role === "student" && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                    <p className="text-xs font-bold text-indigo-900">
                      調配健身室管理範圍
                    </p>
                    <select
                      value={assignTenantId}
                      onChange={(e) => setAssignTenantId(e.target.value)}
                      className="w-full rounded-xl border border-indigo-200 px-3 py-2.5 text-sm bg-white"
                    >
                      <option value="">— 選擇健身室 —</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.gymName}
                          {t.slug === AI_SOLO_TENANT_SLUG ? " (AI 散客)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={assigning || !assignTenantId}
                      onClick={() => void handleAssign()}
                      className={`w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 ${btnClass}`}
                    >
                      {assigning ? "調配中…" : "確認調配"}
                    </button>
                  </div>
                )}

                {profile.user.role === "coach" && (
                  <p className="text-xs text-zinc-500 text-center">
                    教練帳戶請在「新增合作 Gym」區塊管理品牌綁定。
                  </p>
                )}

                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDeleteAccount()}
                  className={`w-full py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${btnClass}`}
                >
                  <Trash2 size={16} aria-hidden />
                  {deleting ? "刪除中…" : "永久刪除此帳戶"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
