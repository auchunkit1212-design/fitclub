"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readApiJson } from "@/lib/api-client";
import {
  Building2,
  CircleUser,
  IconLabel,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "@/components/icons";
import { AI_SOLO_TENANT_SLUG } from "@/lib/registry-constants";
import { getSessionRequestHeaders } from "@/lib/session";
import type { AdminUserProfileDetail } from "@/lib/admin-users";
import type { RegistryUser, Tenant, ThemeColor, UserPlan } from "@/lib/types";

type AccountEditForm = {
  name: string;
  role: RegistryUser["role"];
  gym: string;
  tenantId: string;
  plan: UserPlan;
  coach: string;
  addedBy: string;
  appTitle: string;
  themeColor: ThemeColor;
  logo: string;
  broadcast: string;
  avatarUrl: string;
  currentStreak: string;
  longestStreak: string;
};

function formSnapshot(form: AccountEditForm): string {
  return JSON.stringify(form);
}

function profileToEditForm(profile: AdminUserProfileDetail): AccountEditForm {
  const user = profile.user;
  return {
    name: user.name,
    role: user.role,
    gym: user.gym ?? "",
    tenantId: user.tenantId ?? "",
    plan: user.plan ?? "free",
    coach: user.coach ?? "",
    addedBy: user.addedBy ?? "",
    appTitle: user.appTitle ?? "",
    themeColor: user.themeColor ?? "emerald",
    logo: user.logo ?? "",
    broadcast: user.broadcast ?? "",
    avatarUrl: user.avatarUrl ?? "",
    currentStreak: String(user.currentStreak ?? 0),
    longestStreak: String(user.longestStreak ?? 0),
  };
}

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
  const [editForm, setEditForm] = useState<AccountEditForm | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveInFlightRef = useRef(false);
  const loadRequestRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadAccounts = useCallback(
    async (opts?: { silent?: boolean; toastOnSuccess?: boolean }) => {
      const requestId = ++loadRequestRef.current;
      const showBusy = !opts?.silent;
      if (showBusy) {
        setLoading(true);
        setRefreshing(true);
      }
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/admin/accounts?_=${Date.now()}`,
          {
            credentials: "include",
            cache: "no-store",
            headers: getSessionRequestHeaders(),
          }
        );
        const data = (await res.json()) as {
          users?: RegistryUser[];
          tenants?: Tenant[];
          error?: string;
        };
        if (requestId !== loadRequestRef.current) return false;

        if (!res.ok) {
          const msg = data.error ?? "讀取帳戶失敗";
          setLoadError(msg);
          onToastRef.current(msg);
          return false;
        }
        if (data.users) onRegistryChangeRef.current(data.users);
        if (data.tenants) setTenants(data.tenants);
        if (opts?.toastOnSuccess) onToastRef.current("帳戶列表已重新整理");
        return true;
      } catch {
        if (requestId !== loadRequestRef.current) return false;
        const msg = "無法連線讀取帳戶";
        setLoadError(msg);
        onToastRef.current(msg);
        return false;
      } finally {
        if (requestId === loadRequestRef.current && showBusy) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadAccounts({ silent: registry.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => void loadAccounts({ silent: true });
    window.addEventListener("fitclub:admin-tenants-changed", handler);
    return () =>
      window.removeEventListener("fitclub:admin-tenants-changed", handler);
  }, [loadAccounts]);

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

  const reloadProfile = useCallback(
    async (email: string, options?: { keepOpen?: boolean }) => {
      if (!options?.keepOpen) {
        setSelectedEmail(email);
        setProfile(null);
        setEditForm(null);
      }
      setProfileLoading(true);
      try {
        const res = await fetch(
          `/api/admin/users/profile?email=${encodeURIComponent(email)}&_=${Date.now()}`,
          {
            credentials: "include",
            cache: "no-store",
            headers: getSessionRequestHeaders(),
          }
        );
        const data = (await res.json()) as AdminUserProfileDetail & {
          error?: string;
        };
        if (!res.ok) {
          onToastRef.current(data.error ?? "讀取 profile 失敗");
          if (!options?.keepOpen) setSelectedEmail(null);
          return false;
        }
        setProfile(data);
        const form = profileToEditForm(data);
        setEditForm(form);
        setSavedSnapshot(formSnapshot(form));
        setLastSavedAt(Date.now());
        return true;
      } catch {
        onToastRef.current("讀取 profile 失敗");
        if (!options?.keepOpen) setSelectedEmail(null);
        return false;
      } finally {
        setProfileLoading(false);
      }
    },
    []
  );

  const openProfile = (email: string) => void reloadProfile(email);

  const isDirty = useMemo(() => {
    if (!editForm) return false;
    return formSnapshot(editForm) !== savedSnapshot;
  }, [editForm, savedSnapshot]);

  const handleRefreshAll = useCallback(async () => {
    if (isDirty) {
      const ok = window.confirm(
        "有未儲存變更，重新整理會捨棄目前編輯內容，確定繼續？"
      );
      if (!ok) return;
    }
    const ok = await loadAccounts({ toastOnSuccess: true });
    if (ok && selectedEmail) {
      await reloadProfile(selectedEmail, { keepOpen: true });
    }
  }, [isDirty, loadAccounts, reloadProfile, selectedEmail]);

  const closeProfile = () => {
    if (isDirty) {
      const ok = window.confirm("有未儲存變更，確定關閉？");
      if (!ok) return;
    }
    setSelectedEmail(null);
    setProfile(null);
    setEditForm(null);
    setSavedSnapshot("");
    setLastSavedAt(null);
    setResetPassword("");
  };

  const applySavedUser = useCallback(
    (nextUser: RegistryUser, options?: { toast?: string; reloadList?: boolean }) => {
      onRegistryChangeRef.current(
        registryRef.current.map((u) =>
          u.email.toLowerCase() === nextUser.email.toLowerCase() ? nextUser : u
        )
      );
      setProfile((prev) => {
        if (!prev) return prev;
        const nextProfile = {
          ...prev,
          user: nextUser,
          tenant:
            tenants.find((t) => t.id === nextUser.tenantId) ?? prev.tenant,
        };
        const form = profileToEditForm(nextProfile);
        setEditForm(form);
        setSavedSnapshot(formSnapshot(form));
        setLastSavedAt(Date.now());
        return nextProfile;
      });
      if (options?.toast) onToastRef.current(options.toast);
      if (options?.reloadList !== false) void loadAccounts({ silent: true });
    },
    [loadAccounts, tenants]
  );

  const patchEditForm = (patch: Partial<AccountEditForm>) => {
    setEditForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSaveAccount = useCallback(
    async (options?: { auto?: boolean; formOverride?: AccountEditForm }) => {
      if (!profile || saveInFlightRef.current) return false;
      const form = options?.formOverride ?? editForm;
      if (!form) return false;

      if (form.name.trim().length < 1) {
        if (!options?.auto) onToastRef.current("請填寫姓名");
        return false;
      }

      if (!options?.auto && !options?.formOverride && !isDirty) {
        onToastRef.current("沒有變更需要儲存");
        return true;
      }

      if (
        !options?.auto &&
        profile.user.role === "coach" &&
        form.role === "student" &&
        !window.confirm(
          "確定將此教練帳戶改為學員？教練品牌設定會被清除，對應學員將以新角色登入。"
        )
      ) {
        return false;
      }

      saveInFlightRef.current = true;
      setSavingAccount(true);
      try {
        const res = await fetch("/api/admin/users/update", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getSessionRequestHeaders(),
          },
          body: JSON.stringify({
            email: profile.user.email,
            name: form.name.trim(),
            role: form.role,
            gym: form.gym.trim(),
            tenantId: form.tenantId || null,
            plan: form.plan,
            coach: form.coach.trim() || null,
            addedBy: form.addedBy.trim() || null,
            appTitle: form.appTitle.trim() || null,
            themeColor: form.themeColor,
            logo: form.logo.trim() || null,
            broadcast: form.broadcast.trim() || null,
            avatarUrl: form.avatarUrl.trim() || null,
            currentStreak: Number(form.currentStreak) || 0,
            longestStreak: Number(form.longestStreak) || 0,
            syncTenantOwner: form.role === "coach" && Boolean(form.tenantId),
          }),
        });
        const { data, parseError } = await readApiJson<{
          user?: RegistryUser;
          error?: string;
        }>(res);

        if (!res.ok || parseError || !data?.user) {
          onToastRef.current(data?.error ?? "儲存失敗");
          return false;
        }

        applySavedUser(data.user, {
          toast: options?.auto ? "已自動儲存" : "帳戶資料已更新",
        });
        return true;
      } catch {
        onToastRef.current("儲存失敗，請稍後再試");
        return false;
      } finally {
        saveInFlightRef.current = false;
        setSavingAccount(false);
      }
    },
    [applySavedUser, editForm, isDirty, profile]
  );

  useEffect(() => {
    if (!editForm || !profile || !isDirty || savingAccount) return;

    const timer = setTimeout(() => {
      void handleSaveAccount({ auto: true });
    }, 1200);

    return () => clearTimeout(timer);
  }, [editForm, handleSaveAccount, isDirty, profile, savingAccount]);

  const handleRoleChange = (role: RegistryUser["role"]) => {
    if (!editForm || !profile) return;
    if (profile.user.role === "coach" && role === "student") {
      if (
        !window.confirm(
          "確定將此教練帳戶改為學員？教練品牌設定會被清除，對應學員將以新角色登入。"
        )
      ) {
        return;
      }
    }
    const nextForm = { ...editForm, role };
    setEditForm(nextForm);
    void handleSaveAccount({ auto: true, formOverride: nextForm });
  };

  const handleTenantChange = (tenantId: string) => {
    if (!editForm) return;
    const matched = tenantId ? tenants.find((t) => t.id === tenantId) : null;
    const nextForm = {
      ...editForm,
      tenantId,
      gym: matched?.gymName ?? (tenantId ? editForm.gym : "未綁定分店"),
    };
    setEditForm(nextForm);
    void handleSaveAccount({ auto: true, formOverride: nextForm });
  };

  const handlePlanChange = async (plan: UserPlan) => {
    if (!editForm || !profile) return;
    const nextForm = { ...editForm, plan };
    setEditForm(nextForm);
    const ok = await handleSaveAccount({ auto: true, formOverride: nextForm });
    if (ok) {
      await reloadProfile(profile.user.email, { keepOpen: true });
      onToastRef.current(
        plan === "pro" ? "已設為 Pro" : "已設為 Free"
      );
    }
  };

  const handleAdminSyncStripe = async () => {
    if (!profile?.user.email || syncingStripe) return;
    setSyncingStripe(true);
    try {
      const res = await fetch("/api/admin/users/sync-stripe", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        body: JSON.stringify({ email: profile.user.email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onToastRef.current(data.error ?? "Stripe 同步失敗");
        return;
      }
      onToastRef.current("已從 Stripe 同步訂閱");
      await reloadProfile(profile.user.email, { keepOpen: true });
      void loadAccounts({ silent: true });
    } catch {
      onToastRef.current("Stripe 同步失敗");
    } finally {
      setSyncingStripe(false);
    }
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
      const { data, parseError } = await readApiJson<{ error?: string }>(res);
      if (parseError || !data) {
        onToastRef.current("伺服器回應異常，刪除可能未完成，請重新整理後確認。");
        return;
      }
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
            onClick={() => void handleRefreshAll()}
            disabled={refreshing}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 disabled:opacity-50 ${btnClass}`}
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
              aria-hidden
            />
            {refreshing ? "重新整理中…" : "重新整理"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          撳姓名編輯帳戶：可改角色（教練↔學員）、健身室、品牌資料、密碼等所有欄位。
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
        ) : refreshing && registry.length > 0 ? (
          <p className="text-xs text-zinc-500 text-center py-2 flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            正在重新整理帳戶列表…
          </p>
        ) : null}

        {!loading || registry.length > 0 ? (
          filtered.length === 0 ? (
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
          )
        ) : null}
      </section>

      {selectedEmail && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-profile-title"
        >
          <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="shrink-0 bg-white border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
              <h3
                id="admin-profile-title"
                className="font-bold text-zinc-900 flex items-center gap-2"
              >
                <CircleUser size={20} className="text-emerald-600" aria-hidden />
                帳戶 Profile
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleRefreshAll()}
                  disabled={refreshing || profileLoading}
                  className={`p-2 rounded-full hover:bg-zinc-100 disabled:opacity-50 ${btnClass}`}
                  aria-label="重新整理"
                  title="重新整理帳戶資料"
                >
                  <RefreshCw
                    size={18}
                    className={
                      refreshing || profileLoading ? "animate-spin text-zinc-500" : "text-zinc-700"
                    }
                    aria-hidden
                  />
                </button>
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
            </div>

            {profileLoading || !profile ? (
              <div className="p-8 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin" aria-hidden />
                載入 profile…
              </div>
            ) : editForm ? (
              <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <p className="text-sm font-mono text-zinc-500">{profile.user.email}</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    飲食記錄 {profile.mealCount} 筆
                    {profile.tenant ? ` · 邀請碼 ${profile.tenant.slug}` : ""}
                  </p>
                  <p className="text-[11px] mt-1">
                    {savingAccount ? (
                      <span className="text-amber-700 font-medium">儲存中…</span>
                    ) : isDirty ? (
                      <span className="text-amber-700 font-medium">有未儲存變更（將自動儲存）</span>
                    ) : lastSavedAt ? (
                      <span className="text-emerald-700 font-medium">已儲存</span>
                    ) : null}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 space-y-3">
                  <p className="text-xs font-bold text-zinc-800">帳戶資料（改完會自動儲存）</p>

                  <label className="block text-xs text-zinc-600">
                    姓名
                    <input
                      value={editForm.name}
                      onChange={(e) => patchEditForm({ name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs text-zinc-600">
                      角色
                      <select
                        value={editForm.role}
                        onChange={(e) =>
                          handleRoleChange(e.target.value as RegistryUser["role"])
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                      >
                        <option value="student">學員</option>
                        <option value="coach">教練</option>
                      </select>
                    </label>
                    <label className="block text-xs text-zinc-600">
                      方案
                      <select
                        value={editForm.plan}
                        onChange={(e) =>
                          handlePlanChange(e.target.value as UserPlan)
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                      </select>
                    </label>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-2">
                    <p className="text-[11px] font-bold text-emerald-900">
                      訂閱 / Stripe
                    </p>
                    <p className="text-[11px] text-emerald-900/80 font-mono break-all">
                      Customer:{" "}
                      {profile.billing?.stripeCustomerId ?? "— 未連結 —"}
                    </p>
                    <p className="text-[11px] text-emerald-900/80 font-mono break-all">
                      Subscription:{" "}
                      {profile.billing?.stripeSubscriptionId ?? "— 未連結 —"}
                    </p>
                    <button
                      type="button"
                      disabled={syncingStripe}
                      onClick={() => void handleAdminSyncStripe()}
                      className={`w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-60 ${btnClass}`}
                    >
                      {syncingStripe
                        ? "同步 Stripe 中…"
                        : "從 Stripe 同步訂閱（設 Pro + Customer ID）"}
                    </button>
                    <p className="text-[10px] text-emerald-800/70 leading-relaxed">
                      若學員已付款但方案仍 Free，先撳同步；或確認 Supabase 已執行
                      user-plan.sql 同 stripe-billing.sql。
                    </p>
                  </div>

                  <label className="block text-xs text-zinc-600">
                    健身室／品牌名稱
                    <input
                      value={editForm.gym}
                      onChange={(e) => patchEditForm({ gym: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                    />
                  </label>

                  <label className="block text-xs text-zinc-600">
                    綁定健身室 (Tenant)
                    <select
                      value={editForm.tenantId}
                      onChange={(e) => handleTenantChange(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">— 不綁定 —</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.gymName}
                          {t.slug === AI_SOLO_TENANT_SLUG ? " (AI 散客)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  {editForm.role === "student" && (
                    <div className="grid grid-cols-1 gap-2">
                      <label className="block text-xs text-zinc-600">
                        負責教練（顯示名）
                        <input
                          value={editForm.coach}
                          onChange={(e) => patchEditForm({ coach: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                        />
                      </label>
                      <label className="block text-xs text-zinc-600">
                        加入者 Email (added_by)
                        <input
                          value={editForm.addedBy}
                          onChange={(e) => patchEditForm({ addedBy: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono bg-white"
                        />
                      </label>
                    </div>
                  )}

                  {editForm.role === "coach" && (
                    <div className="space-y-2 border-t border-zinc-200 pt-3">
                      <p className="text-[11px] font-semibold text-indigo-800">
                        教練品牌設定
                      </p>
                      <label className="block text-xs text-zinc-600">
                        App 標題
                        <input
                          value={editForm.appTitle}
                          onChange={(e) => patchEditForm({ appTitle: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                        />
                      </label>
                      <label className="block text-xs text-zinc-600">
                        主題色
                        <select
                          value={editForm.themeColor}
                          onChange={(e) =>
                            patchEditForm({
                              themeColor: e.target.value as ThemeColor,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                        >
                          <option value="emerald">Emerald</option>
                          <option value="blue">Blue</option>
                          <option value="black">Black</option>
                        </select>
                      </label>
                      <label className="block text-xs text-zinc-600">
                        Logo URL
                        <input
                          value={editForm.logo}
                          onChange={(e) => patchEditForm({ logo: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono bg-white"
                        />
                      </label>
                      <label className="block text-xs text-zinc-600">
                        廣播訊息
                        <textarea
                          value={editForm.broadcast}
                          onChange={(e) => patchEditForm({ broadcast: e.target.value })}
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white resize-none"
                        />
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs text-zinc-600">
                      連續打卡
                      <input
                        type="number"
                        min={0}
                        value={editForm.currentStreak}
                        onChange={(e) =>
                          patchEditForm({ currentStreak: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="block text-xs text-zinc-600">
                      最長連續
                      <input
                        type="number"
                        min={0}
                        value={editForm.longestStreak}
                        onChange={(e) =>
                          patchEditForm({ longestStreak: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
                      />
                    </label>
                  </div>

                  <label className="block text-xs text-zinc-600">
                    頭像 URL
                    <input
                      value={editForm.avatarUrl}
                      onChange={(e) => patchEditForm({ avatarUrl: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono bg-white"
                    />
                  </label>

                </div>

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

              <div className="shrink-0 border-t border-zinc-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  disabled={savingAccount || !isDirty}
                  onClick={() => void handleSaveAccount()}
                  className={`w-full py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 ${btnClass}`}
                >
                  {savingAccount
                    ? "儲存中…"
                    : isDirty
                      ? "立即儲存變更"
                      : "已儲存"}
                </button>
              </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
