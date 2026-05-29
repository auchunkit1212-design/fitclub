"use client";

import { useState } from "react";
import { generateCoachReport } from "@/lib/ai-mock";
import {
  emailExists,
  getUserRegistry,
  saveUserRegistry,
} from "@/lib/registry";
import type { MealLog, RegistryUser, UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface FranchiseConsoleProps {
  session: UserSession;
  registry: RegistryUser[];
  logs: MealLog[];
  onRegistryChange: (users: RegistryUser[]) => void;
  onToast: (message: string) => void;
  onGoCoach: () => void;
}

export function FranchiseConsole({
  session,
  registry,
  logs,
  onRegistryChange,
  onToast,
  onGoCoach,
}: FranchiseConsoleProps) {
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffGym, setNewStaffGym] = useState("FitClub 銅鑼灣店");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const staffList = registry.filter((user) => user.role === "coach");
  const studentList = registry.filter((user) => {
    if (user.role !== "student") return false;
    if (session.role === "admin") return true;
    return user.addedBy === session.email;
  });

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail.trim() || !newStaffName.trim()) {
      onToast("⚠️ 請輸入完整 Email 與名字！");
      return;
    }
    if (emailExists(newStaffEmail)) {
      onToast("🚨 該 Email 已經登記過！");
      return;
    }

    const updated = [
      ...getUserRegistry(),
      {
        email: newStaffEmail.trim().toLowerCase(),
        name: newStaffName.trim(),
        role: "coach" as const,
        gym: newStaffGym,
        addedBy: session.email,
      },
    ];
    saveUserRegistry(updated);
    onRegistryChange(updated);
    setNewStaffEmail("");
    setNewStaffName("");
    onToast(`👑 已授權教練：${newStaffName}`);
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentEmail.trim() || !newStudentName.trim()) {
      onToast("⚠️ 請輸入學員 Email 與名字！");
      return;
    }
    if (emailExists(newStudentEmail)) {
      onToast("🚨 該學員 Email 已被登記！");
      return;
    }

    const updated = [
      ...getUserRegistry(),
      {
        email: newStudentEmail.trim().toLowerCase(),
        name: newStudentName.trim(),
        role: "student" as const,
        gym: session.gym,
        coach: session.name,
        addedBy: session.email,
      },
    ];
    saveUserRegistry(updated);
    onRegistryChange(updated);
    setNewStudentEmail("");
    setNewStudentName("");
    onToast(`💪 已登記學員：${newStudentName}`);
  };

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setAiReport(null);
    setTimeout(() => {
      setAiReport(generateCoachReport(logs));
      setIsGenerating(false);
      onToast("✨ AI 報告已生成！");
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {(session.role === "admin" || session.role === "coach") && (
        <section className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-lg space-y-3">
          <h2 className="text-sm font-bold text-indigo-300">
            📊 一鍵 AI 智能整合
          </h2>
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerateReport}
            className={`w-full py-3 bg-indigo-600 font-semibold rounded-xl disabled:opacity-60 ${btnClass}`}
          >
            {isGenerating ? "⏳ AI 整合緊..." : "🧠 整合學員飲食記錄"}
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
            🛠️ 加封分店教練 / 老闆
          </h2>
          <form onSubmit={handleAddStaff} className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="教練姓名"
                className="rounded-xl border border-zinc-200 px-3 py-2.5"
              />
              <select
                value={newStaffGym}
                onChange={(e) => setNewStaffGym(e.target.value)}
                className="rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                <option>FitClub 銅鑼灣店</option>
                <option>FitClub 旺角店</option>
                <option>FitClub 荃灣店</option>
              </select>
            </div>
            <input
              type="email"
              value={newStaffEmail}
              onChange={(e) => setNewStaffEmail(e.target.value)}
              placeholder="教練登入 Email"
              className="w-full rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2.5"
            />
            <button
              type="submit"
              className={`w-full py-3 bg-zinc-900 text-white font-semibold rounded-xl ${btnClass}`}
            >
              🚀 授權並加入名單
            </button>
          </form>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {staffList.map((staff) => (
              <div
                key={staff.email}
                className="p-2.5 bg-zinc-50 rounded-xl flex justify-between text-xs"
              >
                <div>
                  <p className="font-semibold">{staff.name}</p>
                  <p className="text-zinc-500 font-mono">{staff.email}</p>
                </div>
                <span className="text-blue-700 font-medium">{staff.gym}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {session.role === "coach" && (
        <>
          <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
            <h2 className="font-semibold text-zinc-800 mb-2">🎨 品牌設定</h2>
            <button
              type="button"
              onClick={onGoCoach}
              className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-xl ${btnClass}`}
            >
              進入教練後台（Logo / 廣播）
            </button>
          </section>

          <section className="bg-white rounded-2xl border border-blue-100 p-4 space-y-3 shadow-sm">
            <h2 className="font-semibold text-blue-900 border-l-4 border-blue-600 pl-2">
              🎟️ 登記分店學員 Email
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
                  value={session.gym}
                  disabled
                  className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2.5"
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
                className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-xl ${btnClass}`}
              >
                ➕ 登記學員並開通
              </button>
            </form>
          </section>
        </>
      )}

      {(session.role === "admin" || session.role === "coach") && (
        <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
          <h2 className="font-semibold text-zinc-800 mb-2">
            📋 旗下學員名單 ({studentList.length})
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
                  className="p-2.5 bg-zinc-50 rounded-xl flex justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold">{student.name}</p>
                    <p className="text-zinc-500 font-mono">{student.email}</p>
                  </div>
                  <span className="text-emerald-700 font-medium">{student.gym}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
