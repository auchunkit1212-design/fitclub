import {
  fetchAllUsers,
  fetchMealLogs,
  fetchStudentBodyProfilesForEmails,
  filterStudentsForSession,
} from "@/lib/db";
import {
  MACRO_SOFT_MAX_RATIO,
  macroComplianceLevel,
  overallMacroLevel,
  resolveStudentTargetSnapshots,
  type ComplianceLevel,
  type MacroTargets,
  type MacroTotals,
} from "@/lib/nutrition-compliance";
import { fetchNutritionTargetsForEmails } from "@/lib/phase4-db";
import type { MealLog, RegistryUser, UserSession } from "@/lib/types";

/** 打卡一日（有記錄） */
export const LEADERBOARD_CHECKIN_POINTS = 1;
/** 部分達標額外分（全日共 2） */
export const LEADERBOARD_PARTIAL_BONUS = 1;
/** 達標額外分（全日共 3） */
export const LEADERBOARD_MET_BONUS = 2;

export type LeaderboardEntry = {
  rank: number;
  name: string;
  avatarUrl: string | null;
  score: number;
  loggedDays: number;
  metDays: number;
  partialDays: number;
  isViewer: boolean;
};

export type LeaderboardMonthResult = {
  year: number;
  month: number;
  from: string;
  to: string;
  gymName: string;
  peerCount: number;
  entries: LeaderboardEntry[];
  viewer: {
    rank: number | null;
    score: number;
    loggedDays: number;
    metDays: number;
    partialDays: number;
  };
};

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

function dayKey(date: string): string {
  return date.slice(0, 10);
}

function emptyTotals(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fats: 0 };
}

export function hongKongYearMonth(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

export function monthDateRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

export function pointsForDay(level: ComplianceLevel): number {
  if (level === "none") return 0;
  if (level === "met") {
    return LEADERBOARD_CHECKIN_POINTS + LEADERBOARD_MET_BONUS;
  }
  if (level === "partial") {
    return LEADERBOARD_CHECKIN_POINTS + LEADERBOARD_PARTIAL_BONUS;
  }
  return LEADERBOARD_CHECKIN_POINTS;
}

type DayBucket = MacroTotals & { mealCount: number };

function groupLogsByStudentDay(
  logs: MealLog[]
): Map<string, Map<string, DayBucket>> {
  const byEmail = new Map<string, Map<string, DayBucket>>();
  for (const log of logs) {
    const email = emailKey(log.email);
    const date = dayKey(log.date);
    if (!email || !date) continue;
    const days = byEmail.get(email) ?? new Map<string, DayBucket>();
    const prev = days.get(date) ?? { ...emptyTotals(), mealCount: 0 };
    days.set(date, {
      calories: prev.calories + (log.calories || 0),
      protein: prev.protein + (log.protein || 0),
      carbs: prev.carbs + (log.carbs || 0),
      fats: prev.fats + (log.fats || 0),
      mealCount: prev.mealCount + 1,
    });
    byEmail.set(email, days);
  }
  return byEmail;
}

function overallForTotals(
  totals: MacroTotals,
  mealCount: number,
  targets: MacroTargets
): ComplianceLevel {
  const softCap = { maxRatio: MACRO_SOFT_MAX_RATIO };
  return overallMacroLevel(
    macroComplianceLevel(totals.calories, targets.calories, softCap),
    macroComplianceLevel(totals.protein, targets.protein),
    macroComplianceLevel(totals.carbs, targets.carbs, softCap),
    macroComplianceLevel(totals.fats, targets.fats, softCap),
    mealCount
  );
}

export function scoreStudentMonth(
  days: Map<string, DayBucket> | undefined,
  targets: MacroTargets
): {
  score: number;
  loggedDays: number;
  metDays: number;
  partialDays: number;
} {
  let score = 0;
  let loggedDays = 0;
  let metDays = 0;
  let partialDays = 0;
  if (!days) {
    return { score, loggedDays, metDays, partialDays };
  }
  const buckets = Array.from(days.values());
  for (const bucket of buckets) {
    if (bucket.mealCount <= 0) continue;
    loggedDays += 1;
    const level = overallForTotals(bucket, bucket.mealCount, targets);
    score += pointsForDay(level);
    if (level === "met") metDays += 1;
    if (level === "partial") partialDays += 1;
  }
  return { score, loggedDays, metDays, partialDays };
}

/** 同分店／同教練學員；散客只見自己 */
export function filterPeersForLeaderboard(
  session: UserSession,
  registry: RegistryUser[]
): RegistryUser[] {
  if (session.role === "admin" || session.role === "coach") {
    return filterStudentsForSession(session, registry);
  }

  const self = emailKey(session.email);
  const addedBy = session.addedBy?.trim().toLowerCase();
  const coachName = session.coach?.trim();

  return registry.filter((u) => {
    if (u.role !== "student") return false;
    if (emailKey(u.email) === self) return true;
    if (session.tenantId && u.tenantId === session.tenantId) return true;
    if (addedBy && u.addedBy?.trim().toLowerCase() === addedBy) return true;
    if (coachName && u.coach?.trim() === coachName) return true;
    return false;
  });
}

function displayName(user: RegistryUser): string {
  return user.name?.trim() || user.email.split("@")[0] || "學員";
}

export async function buildMonthlyLeaderboard(
  session: UserSession,
  year: number,
  month: number
): Promise<LeaderboardMonthResult> {
  const { from, to } = monthDateRange(year, month);
  const registry = await fetchAllUsers();
  const peers = filterPeersForLeaderboard(session, registry);
  const viewerEmail = emailKey(session.email);

  if (peers.length === 0) {
    return {
      year,
      month,
      from,
      to,
      gymName: session.brandName || session.gym || "",
      peerCount: 0,
      entries: [],
      viewer: {
        rank: null,
        score: 0,
        loggedDays: 0,
        metDays: 0,
        partialDays: 0,
      },
    };
  }

  const emails = peers.map((p) => emailKey(p.email));
  const [logs, targetsByEmail, bodies] = await Promise.all([
    fetchMealLogs({ emails, from, to }),
    fetchNutritionTargetsForEmails(emails),
    fetchStudentBodyProfilesForEmails(emails),
  ]);

  const daysByEmail = groupLogsByStudentDay(logs);

  const raw = peers.map((peer) => {
    const email = emailKey(peer.email);
    const targets = resolveStudentTargetSnapshots({
      storedTargets: targetsByEmail.get(email) ?? null,
      bodyProfile: bodies.get(email) ?? null,
    }).active;
    const scored = scoreStudentMonth(daysByEmail.get(email), targets);
    return {
      email,
      name: displayName(peer),
      avatarUrl: peer.avatarUrl ?? null,
      ...scored,
    };
  });

  raw.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.metDays !== a.metDays) return b.metDays - a.metDays;
    if (b.loggedDays !== a.loggedDays) return b.loggedDays - a.loggedDays;
    return a.name.localeCompare(b.name, "zh-Hant");
  });

  const entries: LeaderboardEntry[] = raw.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    avatarUrl: row.avatarUrl,
    score: row.score,
    loggedDays: row.loggedDays,
    metDays: row.metDays,
    partialDays: row.partialDays,
    isViewer: row.email === viewerEmail,
  }));

  const mine = entries.find((e) => e.isViewer) ?? null;

  return {
    year,
    month,
    from,
    to,
    gymName:
      peers.find((p) => p.tenantName)?.tenantName ||
      session.brandName ||
      session.gym ||
      "",
    peerCount: peers.length,
    entries,
    viewer: {
      rank: mine?.rank ?? null,
      score: mine?.score ?? 0,
      loggedDays: mine?.loggedDays ?? 0,
      metDays: mine?.metDays ?? 0,
      partialDays: mine?.partialDays ?? 0,
    },
  };
}
