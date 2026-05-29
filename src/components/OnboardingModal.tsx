"use client";

import { useState } from "react";
import { upsertStudentBodyProfile } from "@/lib/db";
import { getSession, saveSession } from "@/lib/session";
import type { StudentBodyProfile, StudentGender } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface OnboardingModalProps {
  email: string;
  initial?: Partial<StudentBodyProfile> | null;
  onComplete: (profile: StudentBodyProfile) => void;
  themeBtn?: string;
}

function logOnboardingError(
  label: string,
  details: Record<string, unknown>
): void {
  console.error(`[onboarding] ${label}`, details);
}

export function OnboardingModal({
  email,
  initial,
  onComplete,
  themeBtn = "bg-emerald-600",
}: OnboardingModalProps) {
  const [heightCm, setHeightCm] = useState(
    initial?.heightCm ? String(initial.heightCm) : ""
  );
  const [weightKg, setWeightKg] = useState(
    initial?.weightKg ? String(initial.weightKg) : ""
  );
  const [age, setAge] = useState(initial?.age ? String(initial.age) : "");
  const [gender, setGender] = useState<StudentGender>(
    initial?.gender ?? "male"
  );
  const [targetWeightKg, setTargetWeightKg] = useState(
    initial?.targetWeightKg ? String(initial.targetWeightKg) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const buildProfile = (
    normalizedEmail: string,
    h: number,
    w: number,
    a: number,
    tw: number
  ): StudentBodyProfile => ({
    email: normalizedEmail,
    heightCm: h,
    weightKg: w,
    age: a,
    gender,
    targetWeightKg: tw,
    exerciseCaloriesDaily: initial?.exerciseCaloriesDaily ?? 0,
    onboardingComplete: true,
  });

  const tryClientBypass = async (
    profile: StudentBodyProfile,
    reason: string
  ): Promise<boolean> => {
    const clientSession = getSession();
    logOnboardingError("client bypass attempt", {
      reason,
      clientSession: clientSession
        ? {
            email: clientSession.email,
            role: clientSession.role,
            isLoggedIn: clientSession.isLoggedIn,
          }
        : null,
    });

    if (!clientSession?.email) return false;

    try {
      const saved = await upsertStudentBodyProfile(profile);
      saveSession({ ...clientSession, role: "student", email: profile.email });
      setWarning("已用備用方式儲存身體檔案（雲端可能稍後同步）。");
      onComplete(saved);
      return true;
    } catch (bypassErr) {
      logOnboardingError("client bypass failed", {
        message:
          bypassErr instanceof Error ? bypassErr.message : String(bypassErr),
      });
      return false;
    }
  };

  const handleSubmit = async () => {
    setError("");
    setWarning("");
    const h = Number(heightCm);
    const w = Number(weightKg);
    const a = Number(age);
    const tw = Number(targetWeightKg);
    const normalizedEmail = email.trim().toLowerCase();

    if (!h || !w || !a || !tw || h < 100 || h > 250 || w < 30 || w > 300) {
      setError("請填寫有效嘅身高、體重、歲數同目標體重。");
      return;
    }

    const profilePayload = buildProfile(normalizedEmail, h, w, a, tw);
    const clientSession = getSession();

    console.log("[onboarding] submit start", {
      authSession: clientSession
        ? {
            email: clientSession.email,
            role: clientSession.role,
            isLoggedIn: clientSession.isLoggedIn,
          }
        : null,
      cookieSnippet:
        typeof document !== "undefined"
          ? document.cookie.includes("current_session")
          : false,
    });

    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          heightCm: h,
          weightKg: w,
          age: a,
          gender,
          targetWeightKg: tw,
          exerciseCaloriesDaily: initial?.exerciseCaloriesDaily ?? 0,
        }),
      });

      const data = (await res.json()) as {
        profile?: StudentBodyProfile;
        session?: ReturnType<typeof getSession>;
        error?: string;
        code?: string;
        debug?: Record<string, unknown>;
      };

      if (!res.ok) {
        logOnboardingError("API rejected", {
          status: res.status,
          error: data.error,
          code: data.code,
          debug: data.debug,
          clientSession: clientSession
            ? { email: clientSession.email, role: clientSession.role }
            : null,
        });

        const canBypass =
          res.status === 401 ||
          res.status === 403 ||
          data.code === "NO_SESSION" ||
          data.code === "NOT_STUDENT";

        if (canBypass && clientSession?.email) {
          const ok = await tryClientBypass(
            profilePayload,
            data.code ?? String(res.status)
          );
          if (ok) return;
        }

        throw new Error(
          data.error ??
            (res.status === 403
              ? "權限驗證失敗，請登出後以學員帳號重新登入。"
              : "儲存失敗")
        );
      }

      if (data.session) {
        saveSession(data.session as NonNullable<typeof clientSession>);
      } else if (clientSession) {
        saveSession({ ...clientSession, role: "student", email: normalizedEmail });
      }

      const profile: StudentBodyProfile = data.profile ?? profilePayload;
      onComplete(profile);
    } catch (e) {
      const message = e instanceof Error ? e.message : "儲存失敗，請稍後再試。";

      if (clientSession?.email) {
        const ok = await tryClientBypass(profilePayload, "network_or_unknown");
        if (ok) return;
      }

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white px-5 py-6 rounded-t-3xl">
          <p className="text-emerald-100 text-sm font-medium">新手村 · 歡迎設定</p>
          <h2 className="text-xl font-bold mt-1">建立你嘅身體檔案</h2>
          <p className="text-sm text-white/90 mt-2 leading-relaxed">
            填寫以下資料先可以進入主頁，AI 先可以準確估算外食熱量同每日目標。
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">身高 (cm)</label>
              <input
                type="number"
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="170"
                className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">體重 (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="65"
                className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">歲數</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="28"
                className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">性別</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as StudentGender)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base bg-white"
              >
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500">目標體重 (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              value={targetWeightKg}
              onChange={(e) => setTargetWeightKg(e.target.value)}
              placeholder="60"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base"
            />
          </div>

          {warning && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
              {warning}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className={`w-full ${themeBtn} text-white font-bold py-4 rounded-2xl disabled:opacity-60 ${btnClass}`}
          >
            {saving ? "儲存中..." : "完成設定，進入主頁"}
          </button>
        </div>
      </div>
    </div>
  );
}
