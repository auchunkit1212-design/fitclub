"use client";

import { useEffect, useState } from "react";
import { StreakCelebrationAnimation } from "@/components/StreakCelebrationAnimation";
import { StreakMilestoneModal } from "@/components/StreakMilestoneModal";

/**
 * Dev / review preview — continuous-check-in gorilla celebration.
 * Open: /preview/streak-celebration
 * Query: ?days=30&special=1&modal=1
 */
export default function StreakCelebrationPreviewPage() {
  const [days, setDays] = useState(7);
  const [special, setSpecial] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loopKey, setLoopKey] = useState(0);
  const [ready, setReady] = useState(false);

  const [holdCelebrate, setHoldCelebrate] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = Number(params.get("days"));
    if (Number.isFinite(d) && d > 0) setDays(d);
    if (params.get("special") === "1") setSpecial(true);
    if (params.get("hold") === "1") setHoldCelebrate(true);
    if (params.get("modal") === "1") setShowModal(true);
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-zinc-100" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 via-emerald-50/40 to-teal-50/30 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="space-y-1 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
            Preview
          </p>
          <h1 className="text-2xl font-black text-zinc-900">
            大猩猩連續打卡慶祝動畫
          </h1>
          <p className="text-sm text-zinc-600">
            學員打卡成功後會先播呢段，再入去分享卡。
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
            日數
            <input
              type="number"
              min={1}
              max={999}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-center font-bold tabular-nums"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={special}
              onChange={(e) => setSpecial(e.target.checked)}
              className="rounded border-zinc-300"
            />
            里程碑樣式
          </label>
          <button
            type="button"
            onClick={() => setLoopKey((k) => k + 1)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white active:scale-95"
          >
            重播動畫
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white active:scale-95"
          >
            完整彈窗流程
          </button>
        </div>

        <StreakCelebrationAnimation
          key={loopKey}
          days={days}
          isSpecialMilestone={special}
          autoFinishMs={0}
          className="shadow-[0_20px_60px_rgb(5,150,105,0.18)] ring-1 ring-emerald-100"
        />

        <p className="text-center text-xs text-zinc-500">
          正式流程：打卡成功 → 大猩猩慶祝（約 3 秒）→ 分享卡樣式／儲存／分享
        </p>
      </div>

      {showModal ? (
        holdCelebrate ? (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-5">
            <div className="w-full max-w-md space-y-3">
              <StreakCelebrationAnimation
                days={days}
                isSpecialMilestone={special}
                autoFinishMs={0}
                className="shadow-[0_24px_80px_rgb(0,0,0,0.28)]"
              />
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-3 rounded-2xl bg-white/95 text-emerald-800 font-bold text-sm shadow-lg"
              >
                關閉預覽
              </button>
            </div>
          </div>
        ) : (
          <StreakMilestoneModal
            days={days}
            isSpecialMilestone={special}
            onClose={() => setShowModal(false)}
          />
        )
      ) : null}
    </div>
  );
}
