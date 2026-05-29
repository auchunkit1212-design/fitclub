"use client";

import { useState } from "react";
import type { StudentBodyProfile, StudentGender } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface OnboardingModalProps {
  email: string;
  initial?: Partial<StudentBodyProfile> | null;
  onComplete: (profile: StudentBodyProfile) => void;
  themeBtn?: string;
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

  const handleSubmit = async () => {
    setError("");
    const h = Number(heightCm);
    const w = Number(weightKg);
    const a = Number(age);
    const tw = Number(targetWeightKg);

    if (!h || !w || !a || !tw || h < 100 || h > 250 || w < 30 || w > 300) {
      setError("請填寫有效嘅身高、體重、歲數同目標體重。");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "儲存失敗");

      const profile: StudentBodyProfile = data.profile ?? {
        email,
        heightCm: h,
        weightKg: w,
        age: a,
        gender,
        targetWeightKg: tw,
        exerciseCaloriesDaily: initial?.exerciseCaloriesDaily ?? 0,
        onboardingComplete: true,
      };
      onComplete(profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗，請稍後再試。");
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
