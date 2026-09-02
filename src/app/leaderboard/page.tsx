"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { LoadingView } from "@/components/LoadingView";
import { PageHeader } from "@/components/PageHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  Target,
  Users,
} from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import type { LeaderboardMonthResult } from "@/lib/leaderboard";
import { hongKongYearMonth } from "@/lib/leaderboard";
import { getSession, getSessionRequestHeaders } from "@/lib/session";
import type { UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

function monthLabel(year: number, month: number, lang: string): string {
  try {
    return new Date(year, month - 1, 1).toLocaleDateString(lang, {
      year: "numeric",
      month: "long",
    });
  } catch {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
}

type LeaderboardEntry = LeaderboardMonthResult["entries"][number];

function PlayerAvatar({
  entry,
  size = "md",
}: {
  entry: LeaderboardEntry;
  size?: "md" | "lg";
}) {
  const dimensions = size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-sm";
  return (
    <span
      className={`${dimensions} overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 font-black text-white ring-4 ring-white shadow-lg flex shrink-0 items-center justify-center`}
    >
      {entry.avatarUrl ? (
        <img
          src={entry.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        entry.name.slice(0, 1)
      )}
    </span>
  );
}

function PodiumCard({
  entry,
  place,
  label,
  metLabel,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
  label: string;
  metLabel: string;
}) {
  const isChampion = place === 1;
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  const styles =
    place === 1
      ? "from-amber-300 via-yellow-100 to-white border-amber-300 min-h-[12.5rem] -mt-4"
      : place === 2
        ? "from-slate-200 via-slate-50 to-white border-slate-200 min-h-[10.5rem]"
        : "from-orange-200 via-orange-50 to-white border-orange-200 min-h-[10.5rem]";

  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col items-center rounded-[1.75rem] border bg-gradient-to-b px-2 pb-3 pt-4 text-center shadow-[0_12px_30px_rgb(0,0,0,0.08)] ${styles}`}
    >
      <span className="absolute -top-3 text-2xl drop-shadow-sm" aria-hidden>
        {medal}
      </span>
      <div className="relative mt-2">
        <PlayerAvatar entry={entry} size={isChampion ? "lg" : "md"} />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-black text-white">
          #{place}
        </span>
      </div>
      <p className="mt-3 w-full truncate text-xs font-bold text-zinc-900">
        {entry.name}
      </p>
      <p className={`font-black text-emerald-700 ${isChampion ? "text-2xl" : "text-xl"}`}>
        {entry.score}
        <span className="ml-0.5 text-[10px] font-bold text-zinc-500">{label}</span>
      </p>
      <p className="mt-1 text-[9px] font-medium text-zinc-500">
        {entry.metDays} {metLabel}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const current = hongKongYearMonth();
  const [session, setSession] = useState<UserSession | null>(null);
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const [data, setData] = useState<LeaderboardMonthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leaderboard/month?year=${y}&month=${m}`, {
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      const json = (await res.json()) as LeaderboardMonthResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || t("leaderboard.loadFailed", "載入排行榜失敗"));
      }
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("leaderboard.loadFailed", "載入排行榜失敗")
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession) {
      router.replace("/register");
      return;
    }
    setSession(currentSession);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    void load(year, month);
  }, [session, year, month, load]);

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth() + 1;
    if (
      nextYear > current.year ||
      (nextYear === current.year && nextMonth > current.month)
    ) {
      return;
    }
    setYear(nextYear);
    setMonth(nextMonth);
  };

  if (!session) {
    return <LoadingView message={t("common.loading", "載入中…")} />;
  }

  const canGoNext =
    year < current.year || (year === current.year && month < current.month);

  return (
    <PullToRefresh onRefresh={() => load(year, month)}>
      <div className="min-h-screen bg-zinc-50 pb-32 max-w-lg mx-auto">
        <PageHeader
          title={t("leaderboard.title", "減脂挑戰賽")}
          subtitle={data?.gymName || t("leaderboard.subtitle", "每月排行榜")}
          onBack={() => router.push("/community")}
          backLabel={t("leaderboard.back", "← 探索")}
        />

        <main className="space-y-5 px-4 py-4">
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0f766e] p-5 text-white shadow-[0_18px_45px_rgb(5,150,105,0.28)]">
            <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-yellow-300/20 blur-2xl" />
            <div className="absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-cyan-300/15 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ring-1 ring-white/20">
                    <Flame size={13} className="fill-orange-400 text-orange-400" />
                    Monthly challenge
                  </span>
                  <h2 className="mt-3 text-2xl font-black leading-tight">
                    {t("leaderboard.introTitle", "一齊打卡，比下邊個穩陣")}
                  </h2>
                </div>
                <span className="text-5xl drop-shadow-lg" aria-hidden>🏆</span>
              </div>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-emerald-50/90">
                {t(
                  "leaderboard.introBody",
                  "每月重新計分。有打卡就有分，達標加倍。唔使同全世界比，只同自己教練旗下／同分店學員玩。"
                )}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-white/85">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1">
                  <Users size={13} /> {data?.peerCount ?? 0}{" "}
                  {t("leaderboard.players", "參加者")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1">
                  <Calendar size={13} /> {monthLabel(year, month, lang)}
                </span>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label={t("leaderboard.prevMonth", "上個月")}
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 ${btnClass}`}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                {t("leaderboard.subtitle", "每月排行榜")}
              </p>
              <p className="text-sm font-black text-zinc-900">{monthLabel(year, month, lang)}</p>
            </div>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => shiftMonth(1)}
              aria-label={t("leaderboard.nextMonth", "下個月")}
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 disabled:opacity-30 ${btnClass}`}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {data && (
            <section className="relative overflow-hidden rounded-[1.75rem] border border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-300/25 blur-xl" />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">
                    {t("leaderboard.yourRank", "你嘅排名")}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-4xl font-black text-violet-950">
                      {data.viewer.rank ? `#${data.viewer.rank}` : "—"}
                    </p>
                    <p className="text-xs font-semibold text-violet-700">
                      / {data.peerCount}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-violet-700">
                    {t(
                      "leaderboard.rowStats",
                      "打卡 {logged} 日 · 達標 {met} 日",
                      {
                        logged: data.viewer.loggedDays,
                        met: data.viewer.metDays,
                      }
                    )}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3 text-center shadow-sm ring-1 ring-violet-100">
                  <p className="text-[10px] font-bold text-zinc-500">
                    {t("leaderboard.yourScore", "本月分數")}
                  </p>
                  <p className="text-3xl font-black text-emerald-700">
                    {data.viewer.score}
                    <span className="ml-0.5 text-xs font-bold text-zinc-400">
                      {t("leaderboard.points", "分")}
                    </span>
                  </p>
                </div>
              </div>
            </section>
          )}

          {error ? (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : null}

          {loading && !data ? (
            <LoadingView
              variant="section"
              message={t("leaderboard.loading", "計緊本月分數…")}
            />
          ) : data && data.entries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-4 py-10 text-center">
              <p className="text-sm font-medium text-zinc-700">
                {t("leaderboard.emptyTitle", "暫時未有同學一齊玩")}
              </p>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                {t(
                  "leaderboard.emptyHint",
                  "綁定教練或分店之後，同學員就會出現喺呢度。"
                )}
              </p>
            </div>
          ) : data ? (
            <>
            {data.entries.length >= 3 && (
              <section>
                <div className="mb-6 flex items-end gap-2 px-1 pt-4">
                  <PodiumCard
                    entry={data.entries[1]}
                    place={2}
                    label={t("leaderboard.points", "分")}
                    metLabel={t("leaderboard.metDaysShort", "達標日")}
                  />
                  <PodiumCard
                    entry={data.entries[0]}
                    place={1}
                    label={t("leaderboard.points", "分")}
                    metLabel={t("leaderboard.metDaysShort", "達標日")}
                  />
                  <PodiumCard
                    entry={data.entries[2]}
                    place={3}
                    label={t("leaderboard.points", "分")}
                    metLabel={t("leaderboard.metDaysShort", "達標日")}
                  />
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-[1.75rem] border border-zinc-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <p className="text-sm font-black text-zinc-900">
                  🏁 {t("leaderboard.fullRanking", "完整排名")}
                </p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  {data.peerCount} {t("leaderboard.players", "參加者")}
                </span>
              </div>
              <ol>
                {data.entries.map((entry) => {
                  return (
                    <li
                      key={`${entry.rank}-${entry.name}`}
                      className={`flex items-center gap-3 border-b border-zinc-50 px-4 py-3 last:border-b-0 ${
                        entry.isViewer ? "bg-violet-50/80" : ""
                      }`}
                    >
                      <span className={`w-7 shrink-0 text-center text-sm font-black ${
                        entry.rank <= 3 ? "text-amber-600" : "text-zinc-400"
                      }`}>
                        {entry.rank}
                      </span>
                      <PlayerAvatar entry={entry} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-900 truncate">
                          {entry.name}
                          {entry.isViewer
                            ? ` ${t("leaderboard.you", "（你）")}`
                            : ""}
                        </p>
                        <div className="mt-1 flex gap-1.5">
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-bold text-sky-700">
                            {entry.loggedDays} 打卡
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                            {entry.metDays} 達標
                          </span>
                        </div>
                      </div>
                      <p className="shrink-0 text-xl font-black text-emerald-700">
                        {entry.score}
                        <span className="ml-0.5 text-[10px] font-semibold text-zinc-400">
                          {t("leaderboard.points", "分")}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
            </>
          ) : null}

          <section className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Target size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-zinc-900">
                  {t("leaderboard.howToScore", "點樣攞分？")}
                </h3>
                <p className="text-[10px] text-zinc-500">
                  {t("leaderboard.resetsMonthly", "每月 1 號自動重新開始")}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["1", t("leaderboard.checkinShort", "打卡"), "bg-sky-50 text-sky-700"],
                ["2", t("leaderboard.partialShort", "部分達標"), "bg-amber-50 text-amber-700"],
                ["3", t("leaderboard.metShort", "全面達標"), "bg-emerald-50 text-emerald-700"],
              ].map(([points, label, style]) => (
                <div key={points} className={`rounded-2xl p-3 text-center ${style}`}>
                  <p className="text-2xl font-black">+{points}</p>
                  <p className="mt-0.5 text-[10px] font-bold">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              {t(
                "leaderboard.ruleWhy",
                "中間加「部分達標」2 分，等你努力過都有回報，唔會得「完美先有分」。"
              )}
            </p>
          </section>
        </main>

        <BottomNav role={session.role === "admin" ? "admin" : session.role} />
      </div>
    </PullToRefresh>
  );
}
