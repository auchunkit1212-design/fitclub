"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, IconLabel, Loader2, RefreshCw, Trash2 } from "@/components/icons";
import { AI_SOLO_TENANT_SLUG } from "@/lib/registry-constants";
import { getSessionRequestHeaders } from "@/lib/session";
import type { AdminTenantSummary } from "@/lib/admin-users";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  onToast: (message: string) => void;
  onChanged?: () => void;
};

export function AdminTenantsConsole({ onToast, onChanged }: Props) {
  const [tenants, setTenants] = useState<AdminTenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const onToastRef = useRef(onToast);
  const onChangedRef = useRef(onChanged);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    onToastRef.current = onToast;
    onChangedRef.current = onChanged;
  });

  const loadTenants = useCallback(
    async (opts?: { silent?: boolean; toastOnSuccess?: boolean }) => {
      const requestId = ++loadRequestRef.current;
      const showBusy = !opts?.silent;
      if (showBusy) {
        setLoading(true);
        setRefreshing(true);
      }
      setLoadError(null);
      try {
        const res = await fetch(`/api/admin/tenants?_=${Date.now()}`, {
          credentials: "include",
          cache: "no-store",
          headers: getSessionRequestHeaders(),
        });
        const data = (await res.json()) as {
          tenants?: AdminTenantSummary[];
          error?: string;
        };
        if (requestId !== loadRequestRef.current) return false;

        if (!res.ok) {
          const msg = data.error ?? "讀取健身室失敗";
          setLoadError(msg);
          onToastRef.current(msg);
          return false;
        }
        setTenants(data.tenants ?? []);
        if (opts?.toastOnSuccess) {
          onToastRef.current("健身室列表已重新整理");
        }
        return true;
      } catch {
        if (requestId !== loadRequestRef.current) return false;
        const msg = "無法連線讀取健身室";
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
    void loadTenants({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => void loadTenants({ silent: true });
    window.addEventListener("fitclub:admin-tenants-changed", handler);
    return () =>
      window.removeEventListener("fitclub:admin-tenants-changed", handler);
  }, [loadTenants]);

  const handleRefresh = () => void loadTenants({ toastOnSuccess: true });

  const handleDelete = async (tenant: AdminTenantSummary) => {
    if (tenant.slug === AI_SOLO_TENANT_SLUG) {
      onToastRef.current("系統 AI 散客健身室不可刪除");
      return;
    }

    const ok = window.confirm(
      `確定刪除「${tenant.gymName}」？\n\n` +
        `• 邀請碼：${tenant.slug}\n` +
        `• 老闆／教練：${tenant.ownerName ?? tenant.ownerEmail}\n` +
        `• 學員 ${tenant.studentCount} 人會解除綁定（帳戶保留）\n` +
        `• 教練帳戶會一併刪除\n\n` +
        `此操作無法復原。`
    );
    if (!ok) return;

    setDeletingId(tenant.id);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onToastRef.current(data.error ?? "刪除失敗");
        return;
      }
      onToastRef.current(`已刪除健身室「${tenant.gymName}」`);
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
      window.dispatchEvent(new CustomEvent("fitclub:admin-tenants-changed"));
      await loadTenants({ silent: true });
      onChangedRef.current?.();
    } catch {
      onToastRef.current("刪除失敗，請稍後再試");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-zinc-900 border-l-4 border-emerald-600 pl-2">
          <IconLabel icon={Building2} iconClassName="text-emerald-700">
            已登記健身室 ({tenants.length})
          </IconLabel>
        </h2>
        <button
          type="button"
          onClick={handleRefresh}
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
        顯示所有 Tenant／品牌。可刪除合作健身室或自由教練品牌（教練帳戶會移除，學員解除綁定）。
      </p>

      {loadError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {loadError}
        </p>
      )}

      {loading && tenants.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-6 flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          載入健身室中…
        </p>
      ) : refreshing && tenants.length > 0 ? (
        <p className="text-xs text-zinc-500 text-center py-2 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          正在重新整理健身室列表…
        </p>
      ) : null}

      {!loading || tenants.length > 0 ? (
        tenants.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">
            暫未有登記健身室，請用上方表單新增合作品牌。
          </p>
        ) : (
          <ul className="space-y-2 max-h-[min(360px,45vh)] overflow-y-auto">
            {tenants.map((tenant) => {
              const isSystem = tenant.slug === AI_SOLO_TENANT_SLUG;
              return (
                <li
                  key={tenant.id}
                  className="p-3 rounded-xl border border-zinc-100 bg-zinc-50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-zinc-900 truncate">
                        {tenant.gymName}
                        {isSystem && (
                          <span className="ml-1.5 text-[9px] font-bold text-emerald-600 uppercase">
                            系統
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        邀請碼{" "}
                        <span className="font-mono text-emerald-800">
                          {tenant.slug}
                        </span>
                        {" · "}
                        方案 {tenant.plan}
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-1 truncate">
                        老闆／教練：{tenant.ownerName ?? "—"} (
                        <span className="font-mono">{tenant.ownerEmail}</span>)
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        教練 {tenant.coachCount} · 學員 {tenant.studentCount}
                      </p>
                    </div>
                    {!isSystem && (
                      <button
                        type="button"
                        disabled={deletingId === tenant.id || refreshing}
                        onClick={() => void handleDelete(tenant)}
                        className={`shrink-0 p-2 rounded-xl border border-red-200 bg-red-50 text-red-700 disabled:opacity-50 ${btnClass}`}
                        aria-label={`刪除 ${tenant.gymName}`}
                        title="刪除健身室"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}
