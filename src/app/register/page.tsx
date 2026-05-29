"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUPER_ADMIN_EMAIL,
  createAdminSession,
  findRegistryUser,
  initUserRegistry,
  registryUserToSession,
} from "@/lib/registry";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    initUserRegistry();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      showToast("⚠️ 請先輸入您的 Email！");
      return;
    }

    if (normalized === SUPER_ADMIN_EMAIL) {
      localStorage.setItem(
        "current_session",
        JSON.stringify(createAdminSession(normalized))
      );
      showToast("👑 最高總控制官：歡迎回來！");
      setTimeout(() => router.push("/"), 1200);
      return;
    }

    const foundUser = findRegistryUser(normalized);
    if (foundUser) {
      localStorage.setItem(
        "current_session",
        JSON.stringify(registryUserToSession(foundUser))
      );
      const roleLabel = foundUser.role === "coach" ? "教練/老闆" : "學員";
      showToast(`🎉 歡迎 ${foundUser.name}（${roleLabel}）`);
      setTimeout(() => router.push("/"), 1200);
      return;
    }

    showToast("❌ 此 Email 尚未獲授權，請聯絡教練或老闆登記。");
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-zinc-50 p-6 flex flex-col justify-center">
      {toast && (
        <div className="fixed top-4 left-4 right-4 bg-zinc-900 text-white px-4 py-3 rounded-xl z-50 text-sm font-semibold text-center shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-lg border border-zinc-100 space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-900">
            🔒 FitClub 連鎖加盟系統
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            請用已授權 Email 登入
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              📧 電子郵件 (Email)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入登入 Email"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3.5 font-medium"
            />
          </div>

          <button
            type="submit"
            className={`w-full py-4 bg-zinc-900 text-white font-bold rounded-xl shadow-md ${btnClass}`}
          >
            🚀 智能驗證權限並登入
          </button>
        </form>

        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900 space-y-1">
          <p className="font-bold">💡 測試帳號：</p>
          <p>
            • <span className="font-mono">{SUPER_ADMIN_EMAIL}</span> → 總控制台
          </p>
          <p>• <span className="font-mono">owner@gmail.com</span> → 分店教練</p>
          <p>• <span className="font-mono">student@gmail.com</span> → 學員</p>
        </div>
      </div>
    </div>
  );
}
