"use client";

import { useState } from "react";
import {
  BarChart2,
  Brain,
  IconLabel,
  Loader2,
  Palette,
  Rocket,
  Wrench,
} from "@/components/icons";
import { fetchAiCoachReport } from "@/lib/ai-feedback-client";
import {
  emailExists,
  fetchAllUsers,
  fetchMealLogsForSession,
} from "@/lib/db";
import { getSessionRequestHeaders } from "@/lib/session";
import { AdminAccountsConsole } from "@/components/AdminAccountsConsole";
import type { MealLog, RegistryUser, UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

function partnerBrandLabel(user: RegistryUser): string {
  return user.tenantName ?? user.appTitle ?? user.gym ?? "未設定品牌";
}

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
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const staffList = registry.filter((user) => user.role === "coach");

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
    } catch {
      onToast("雲端寫入失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setAiReport(null);
    try {
      const logs: MealLog[] = await fetchMealLogsForSession(session, registry);
      const report = await fetchAiCoachReport({
        logs,
        gymName: session.gym,
      });
      setAiReport(report);
      onToast("已從 Supabase 拉取最新數據並生成報告！");
    } catch {
      onToast("無法從雲端讀取飲食記錄。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {(session.role === "admin" || session.role === "coach") && (
        <section className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-lg space-y-3">
          <h2 className="text-sm font-bold text-indigo-300">
            <IconLabel icon={BarChart2} iconClassName="text-indigo-300">
              一鍵 AI 智能整合（Supabase 實時）
            </IconLabel>
          </h2>
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerateReport}
            className={`w-full py-3 bg-indigo-600 font-semibold rounded-xl disabled:opacity-60 ${btnClass}`}
          >
            {isGenerating ? (
              <IconLabel icon={Loader2} size="md" className="justify-center animate-spin" iconClassName="text-white">
                從雲端整合緊...
              </IconLabel>
            ) : (
              <IconLabel icon={Brain} size="md" className="justify-center" iconClassName="text-white">
                整合旗下學員飲食記錄
              </IconLabel>
            )}
          </button>
          {aiReport && (
            <pre className="bg-white/10 p-3 rounded-xl text-xs whitespace-pre-wrap border border-white/10">
              {aiReport}
            </pre>
          )}
        </section>
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
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {staffList.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-3">
                暫未有合作教練，請用上方表單新增。
              </p>
            ) : (
              staffList.map((staff) => (
                <div
                  key={staff.email}
                  className="p-2.5 bg-zinc-50 rounded-xl flex justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{staff.name}</p>
                    <p className="text-zinc-500 font-mono truncate">{staff.email}</p>
                  </div>
                  <span className="shrink-0 text-right text-blue-700 font-medium max-w-[45%] truncate">
                    {partnerBrandLabel(staff)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
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
