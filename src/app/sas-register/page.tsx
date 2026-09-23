"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLabel, Rocket } from "@/components/icons";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export default function SasRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gymName, setGymName] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/tenant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, gymName }),
      });
      const data = (await res.json()) as { error?: string; gymName?: string };

      if (!res.ok) {
        showToast(data.error ?? "註冊失敗");
        return;
      }

      showToast(`${data.gymName ?? gymName} 已開通免費體驗！`);
      setTimeout(() => router.push("/register"), 1500);
    } catch {
      showToast("連線失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-emerald-950 px-6 py-10 pt-safe pb-safe flex flex-col justify-center">
      {toast && (
        <div className="fixed top-safe left-4 right-4 z-50 max-w-lg mx-auto bg-white text-zinc-900 px-4 py-3 rounded-xl text-sm font-semibold text-center shadow-2xl">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-zinc-100 space-y-5">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            B2B SaaS · 免費體驗
          </p>
          <h1 className="text-2xl font-bold text-zinc-900">開通您的健身房品牌</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            獨立租戶空間 · 白標 App · 學員飲食管理 · 推送提醒
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Gym 房 / 教練名稱
            </label>
            <input
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="例如：銅鑼灣 Power Gym"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3.5"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              登入 Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@yourgym.com"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3.5"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              登入密碼（至少 6 位）
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full rounded-xl border border-zinc-200 px-3 py-3.5"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-60 ${btnClass}`}
          >
            {loading ? (
              "開通緊..."
            ) : (
              <IconLabel icon={Rocket} size="md" className="justify-center" iconClassName="text-white">
                一鍵免費開通
              </IconLabel>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          已有帳號？{" "}
          <Link href="/register" className="text-emerald-600 font-semibold">
            前往登入
          </Link>
        </p>
      </div>
    </div>
  );
}
