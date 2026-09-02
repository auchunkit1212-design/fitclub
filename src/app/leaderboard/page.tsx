"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { LoadingView } from "@/components/LoadingView";
import { PageHeader } from "@/components/PageHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Flame, IconLabel } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import type { LeaderboardMonthResult } from "@/lib/leaderboard";
import { hongKongYearMonth } from "@/lib/leaderboard";
import { getSession, getSessionRequestHeaders } from "@/lib/session";
import type { UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

function medalForRank(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

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

        <main className="px-4 py-4 space-y-4">
          <section className="rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-white border border-amber-100 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <p className="text-sm font-bold text-amber-900">
              <IconLabel icon={Flame} iconClassName="text-orange-500">
                {t("leaderboard.introTitle", "一齊打卡，比下邊個穩陣")}
              </IconLabel>
            </p>
            <p className="text-sm text-amber-900/80 mt-2 leading-relaxed">
              {t(
                "leaderboard.introBody",
                "每月重新計分。有打卡就有分，達標加倍。唔使同全世界比，只同自己教練旗下／同分店學員玩。"
              )}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-800">
              <li>
                {t(
                  "leaderboard.ruleCheckin",
                  "打卡一日 +1 分（有記錄飲食就算）"
                )}
              </li>
              <li>
                {t(
                  "leaderboard.rulePartial",
                  "部分達標 +2 分（蛋白／宏量差少少）"
                )}
              </li>
              <li>
                {t(
                  "leaderboard.ruleMet",
                  "達標一日 +3 分（宏量整體達標）"
                )}
              </li>
            </ul>
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              {t(
                "leaderboard.ruleWhy",
                "中間加「部分達標」2 分，等你努力過都有回報，唔會得「完美先有分」。"
              )}
            </p>
          </section>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className={`px-3 py-2 rounded-xl bg-white border border-zinc-200 text-sm font-semibold text-zinc-700 ${btnClass}`}
            >
              {t("leaderboard.prevMonth", "上個月")}
            </button>
            <p className="text-sm font-bold text-zinc-900">
              {monthLabel(year, month, lang)}
            </p>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => shiftMonth(1)}
              className={`px-3 py-2 rounded-xl bg-white border border-zinc-200 text-sm font-semibold text-zinc-700 disabled:opacity-40 ${btnClass}`}
            >
              {t("leaderboard.nextMonth", "下個月")}
            </button>
          </div>

          {data && (
            <section className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white border border-zinc-100 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase">
                  {t("leaderboard.yourRank", "你嘅排名")}
                </p>
                <p className="text-xl font-bold text-zinc-900 mt-0.5">
                  {data.viewer.rank ? `#${data.viewer.rank}` : "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-zinc-100 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase">
                  {t("leaderboard.yourScore", "本月分數")}
                </p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5">
                  {data.viewer.score}
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-zinc-100 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase">
                  {t("leaderboard.yourMet", "達標日")}
                </p>
                <p className="text-xl font-bold text-zinc-900 mt-0.5">
                  {data.viewer.metDays}
                </p>
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
            <section className="rounded-3xl bg-white border border-zinc-100 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <ol>
                {data.entries.map((entry) => {
                  const medal = medalForRank(entry.rank);
                  return (
                    <li
                      key={`${entry.rank}-${entry.name}`}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-zinc-50 last:border-b-0 ${
                        entry.isViewer ? "bg-emerald-50" : ""
                      }`}
                    >
                      <span className="w-8 text-center text-sm font-bold text-zinc-500 shrink-0">
                        {medal ?? entry.rank}
                      </span>
                      <span
                        className={`w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-white ${
                          entry.avatarUrl ? "bg-zinc-100" : "bg-emerald-600"
                        }`}
                      >
                        {entry.avatarUrl ? (
                          <img
                            src={entry.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          entry.name.slice(0, 1)
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-900 truncate">
                          {entry.name}
                          {entry.isViewer
                            ? ` ${t("leaderboard.you", "（你）")}`
                            : ""}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {t("leaderboard.rowStats", "打卡 {logged} 日 · 達標 {met} 日", {
                            logged: entry.loggedDays,
                            met: entry.metDays,
                          })}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-emerald-700 shrink-0">
                        {entry.score}
                        <span className="text-[11px] font-semibold text-zinc-400 ml-0.5">
                          {t("leaderboard.points", "分")}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </main>

        <BottomNav role={session.role === "admin" ? "admin" : session.role} />
      </div>
    </PullToRefresh>
  );
}
