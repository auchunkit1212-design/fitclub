"use client";

import { useState } from "react";
import { ClipboardList, IconLabel, Plus, Ticket } from "@/components/icons";
import { emailExists, fetchAllUsers, insertUser } from "@/lib/db";
import type { RegistryUser, UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

function partnerBrandLabel(user: RegistryUser): string {
  return user.tenantName ?? user.appTitle ?? user.gym ?? "未設定品牌";
}

type Props = {
  session: UserSession;
  registry: RegistryUser[];
  onRegistryChange: (users: RegistryUser[]) => void;
  onToast: (message: string) => void;
};

export function CoachStudentManagementPanel({
  session,
  registry,
  onRegistryChange,
  onToast,
}: Props) {
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const studentList = registry.filter((user) => {
    if (user.role !== "student") return false;
    if (session.role === "admin") return true;
    return user.addedBy === session.email;
  });

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentEmail.trim() || !newStudentName.trim()) {
      onToast("請填寫學員姓名同 Email！");
      return;
    }
    setSubmitting(true);
    try {
      if (await emailExists(newStudentEmail)) {
        onToast("該 Email 已經登記過！");
        return;
      }
      await insertUser(
        {
          email: newStudentEmail.trim().toLowerCase(),
          name: newStudentName.trim(),
          role: "student",
          gym: session.brandName ?? session.gym,
          coach: session.name,
          addedBy: session.email,
          tenantId: session.tenantId,
        },
        session
      );
      const updated = await fetchAllUsers();
      onRegistryChange(updated);
      setNewStudentEmail("");
      setNewStudentName("");
      onToast(`已登記學員：${newStudentName.trim()}`);
    } catch {
      onToast("雲端寫入失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  };

  if (session.role !== "coach" && session.role !== "admin") return null;

  return (
    <div className="space-y-4">
      {session.role === "coach" && (
        <section className="bg-white rounded-2xl border border-blue-100 p-4 space-y-3 shadow-sm">
          <h2 className="font-semibold text-blue-900 border-l-4 border-blue-600 pl-2">
            <IconLabel icon={Ticket} iconClassName="text-blue-700">
              登記學員 Email
            </IconLabel>
          </h2>
          <form onSubmit={handleAddStudent} className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="學員姓名"
                className="rounded-xl border border-zinc-200 px-3 py-2.5"
              />
              <input
                type="text"
                value={session.brandName ?? session.gym}
                disabled
                className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2.5 truncate"
                title={session.brandName ?? session.gym}
              />
            </div>
            <input
              type="email"
              value={newStudentEmail}
              onChange={(e) => setNewStudentEmail(e.target.value)}
              placeholder="學員登入 Email"
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2.5"
            />
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-60 ${btnClass}`}
            >
              {submitting ? (
                "寫入雲端緊..."
              ) : (
                <IconLabel icon={Plus} size="sm" className="justify-center" iconClassName="text-white">
                  登記學員並開通
                </IconLabel>
              )}
            </button>
          </form>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
        <h2 className="font-semibold text-zinc-800 mb-2">
          <IconLabel icon={ClipboardList} iconClassName="text-zinc-600">
            旗下學員名單 ({studentList.length})
          </IconLabel>
        </h2>
        {studentList.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            暫時未有學員，請用上方表單新增。
          </p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {studentList.map((student) => (
              <li
                key={student.email}
                className="p-2.5 bg-zinc-50 rounded-xl flex justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{student.name}</p>
                  <p className="text-zinc-500 font-mono truncate">{student.email}</p>
                </div>
                <span className="shrink-0 text-emerald-700 font-medium max-w-[45%] truncate">
                  {partnerBrandLabel(student)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
