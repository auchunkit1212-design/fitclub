export const STREAK_MILESTONE_DAYS = [3, 7, 14, 30] as const;

export type StreakMilestoneDay = (typeof STREAK_MILESTONE_DAYS)[number];

const STREAK_TIMEZONE = "Asia/Hong_Kong";

export interface StudentStreakSnapshot {
  currentStreak: number;
  longestStreak: number;
  lastStreakUpdate: string | null;
}

export interface StreakUpdateResult extends StudentStreakSnapshot {
  streakUpdated: boolean;
  /** Show celebration UI on every new streak day. */
  celebrationTriggered: boolean;
  celebrationDays?: number;
  isSpecialMilestone: boolean;
  /** Back-compat alias for celebrationTriggered. */
  milestoneTriggered: boolean;
  /** Back-compat alias for celebrationDays. */
  milestoneDays?: number;
}

/** YYYY-MM-DD in Hong Kong timezone */
export function streakDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STREAK_TIMEZONE,
  }).format(date);
}

export function streakDayDiff(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T12:00:00Z`);
  const b = new Date(`${toKey}T12:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function isStreakMilestone(days: number): days is StreakMilestoneDay {
  return (STREAK_MILESTONE_DAYS as readonly number[]).includes(days);
}

/**
 * Compute streak after a meal log on `todayKey` (default: today HK).
 * Does not persist — use with DB update.
 */
export function computeStreakAfterMealLog(
  snapshot: StudentStreakSnapshot,
  todayKey = streakDateKey()
): StreakUpdateResult {
  const current = Math.max(0, snapshot.currentStreak);
  const longest = Math.max(0, snapshot.longestStreak);
  const lastKey = snapshot.lastStreakUpdate
    ? streakDateKey(new Date(snapshot.lastStreakUpdate))
    : null;

  if (lastKey === todayKey) {
    return {
      currentStreak: current,
      longestStreak: longest,
      lastStreakUpdate: snapshot.lastStreakUpdate,
      streakUpdated: false,
      celebrationTriggered: false,
      isSpecialMilestone: false,
      milestoneTriggered: false,
    };
  }

  let newCurrent: number;
  if (!lastKey) {
    newCurrent = 1;
  } else {
    const gap = streakDayDiff(lastKey, todayKey);
    if (gap === 1) {
      newCurrent = current + 1;
    } else {
      newCurrent = 1;
    }
  }

  const newLongest = Math.max(longest, newCurrent);
  const special = isStreakMilestone(newCurrent);

  return {
    currentStreak: newCurrent,
    longestStreak: newLongest,
    lastStreakUpdate: new Date().toISOString(),
    streakUpdated: true,
    celebrationTriggered: true,
    celebrationDays: newCurrent,
    isSpecialMilestone: special,
    milestoneTriggered: true,
    milestoneDays: newCurrent,
  };
}

export const PENDING_STREAK_CELEBRATION_KEY = "pending_streak_celebration";
/** @deprecated */
export const PENDING_STREAK_MILESTONE_KEY = PENDING_STREAK_CELEBRATION_KEY;

export type PendingStreakCelebration = {
  days: number;
  isSpecialMilestone?: boolean;
};

export function storePendingStreakCelebration(
  payload: PendingStreakCelebration
): void {
  if (typeof sessionStorage === "undefined") return;
  const days = Math.max(1, Math.round(payload.days));
  sessionStorage.setItem(
    PENDING_STREAK_CELEBRATION_KEY,
    JSON.stringify({
      days,
      isSpecialMilestone: Boolean(payload.isSpecialMilestone),
      at: Date.now(),
    })
  );
}

export function consumePendingStreakCelebration(): PendingStreakCelebration | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw =
    sessionStorage.getItem(PENDING_STREAK_CELEBRATION_KEY) ??
    sessionStorage.getItem("pending_streak_milestone");
  sessionStorage.removeItem(PENDING_STREAK_CELEBRATION_KEY);
  sessionStorage.removeItem("pending_streak_milestone");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      days?: number;
      isSpecialMilestone?: boolean;
    };
    const days = Math.max(1, Math.round(Number(parsed.days)));
    if (!Number.isFinite(days) || days < 1) return null;
    return {
      days,
      isSpecialMilestone: Boolean(parsed.isSpecialMilestone),
    };
  } catch {
    return null;
  }
}

/** @deprecated use storePendingStreakCelebration */
export function storePendingStreakMilestone(days: number): void {
  storePendingStreakCelebration({
    days,
    isSpecialMilestone: isStreakMilestone(days),
  });
}

/** @deprecated use consumePendingStreakCelebration */
export function consumePendingStreakMilestone(): number | null {
  return consumePendingStreakCelebration()?.days ?? null;
}
