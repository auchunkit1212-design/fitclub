"use client";

import { useState } from "react";
import { IconLabel, Palette, Rocket, Wrench } from "@/components/icons";
import { emailExists, fetchAllUsers } from "@/lib/db";
import { getSessionRequestHeaders } from "@/lib/session";
import { AdminAccountsConsole } from "@/components/AdminAccountsConsole";
import { AdminTenantsConsole } from "@/components/AdminTenantsConsole";
import { CoachAiReportPanel } from "@/components/CoachAiReportPanel";
import type { RegistryUser, UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface FranchiseConsoleProps {
  session: UserSession;
  registry: RegistryUser[];
  onRegistryChange: (users: RegistryUser[]) => void;
  onToast: (message: string) => void;
  onGoCoach: () => void;
}

export function FranchiseConsole({
  session,
  registry,
  onRegistryChange,
  onToast,
  onGoCoach,
}: FranchiseConsoleProps) {
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail.trim() || !newStaffName.trim() || !newBrandName.trim()) {
      onToast("請輸入品牌名稱、教練姓名與 Email！");
      return;
    }
    setSubmitting(true);
    try {
      if (await emailExists(newStaffEmail)) {
        onToast("該 Email 已經登記過！");
        return;
      }

      const res = await fetch("/api/admin/partner-coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          brandName: newBrandName.trim(),
          coachName: newStaffName.trim(),
          coachEmail: newStaffEmail.trim().toLowerCase(),
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        hint?: string;
        tenant?: { gymName: string };
      };

      if (!res.ok) {
        onToast(`${data.error ?? "建立失敗"}${data.hint ? `（${data.hint}）` : ""}`);
        return;
      }

      const updated = await fetchAllUsers();
      onRegistryChange(updated);
      setNewStaffEmail("");
      setNewStaffName("");
      setNewBrandName("");
      onToast(
        `已新增合作品牌「${data.tenant?.gymName ?? newBrandName.trim()}」教練：${newStaffName.trim()}`
      );
      window.dispatchEvent(new CustomEvent("fitclub:admin-tenants-changed"));
    } catch {
      onToast("雲端寫入失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {(session.role === "admin" || session.role === "coach") && (
        <CoachAiReportPanel
          session={session}
          registry={registry}
          gymName={session.gym}
          onToast={onToast}
          variant="dark"
        />
      )}

      {session.role === "admin" && (
        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
          <h2 className="font-semibold text-zinc-900 border-l-4 border-zinc-900 pl-2">
            <IconLabel icon={Wrench} iconClassName="text-zinc-700">
              新增合作 Gym 品牌 / 自由教練
            </IconLabel>
          </h2>
          <p className="text-xs text-zinc-500">
            每次新增會自動建立獨立 Tenant，教練帳號綁定該品牌並擁有教練後台權限。
          </p>
          <form onSubmit={handleAddStaff} className="space-y-3 text-sm">
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="請輸入 Gym 品牌名稱或自由教練（例如: Oxygym 或 自由教練-Alan）"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="教練姓名"
                className="rounded-xl border border-zinc-200 px-3 py-2.5"
              />
              <input
                type="email"
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="教練登入 Email"
                className="rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2.5"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 bg-zinc-900 text-white font-semibold rounded-xl disabled:opacity-60 ${btnClass}`}
            >
              {submitting ? (
                "建立 Tenant 緊..."
              ) : (
                <IconLabel icon={Rocket} size="sm" className="justify-center" iconClassName="text-white">
                  建立品牌並授權教練
                </IconLabel>
              )}
            </button>
          </form>
        </section>
      )}

      {session.role === "admin" && (
        <AdminTenantsConsole
          onToast={onToast}
          onChanged={async () => {
            try {
              const updated = await fetchAllUsers();
              onRegistryChange(updated);
            } catch {
              // list refresh is best-effort
            }
          }}
        />
      )}

      {session.role === "coach" && (
        <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
          <h2 className="font-semibold text-zinc-800 mb-2">
            <IconLabel icon={Palette} iconClassName="text-zinc-600">
              品牌設定
            </IconLabel>
          </h2>
          <button
            type="button"
            onClick={onGoCoach}
            className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-xl ${btnClass}`}
          >
            進入教練後台（Logo / 廣播 → 雲端）
          </button>
          <p className="text-xs text-zinc-500 mt-2 text-center">
            學員登記同飲食紀錄請用底部「學員」分欄
          </p>
        </section>
      )}

      {session.role === "admin" && (
        <AdminAccountsConsole
          registry={registry}
          onRegistryChange={onRegistryChange}
          onToast={onToast}
        />
      )}
    </div>
  );
}
