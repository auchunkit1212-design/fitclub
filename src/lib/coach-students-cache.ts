import type {
  MealLog,
  MealLogFeedback,
  MealLogReaction,
  RegistryUser,
} from "@/lib/types";

export type StudentsCache = {
  email: string;
  registry: RegistryUser[];
  logs: MealLog[];
  students: RegistryUser[];
  at: number;
};

export type ReviewCache = {
  email: string;
  reactions: MealLogReaction[];
  feedback: MealLogFeedback[];
  logIdsKey: string;
  at: number;
};

let studentsCache: StudentsCache | null = null;
let reviewCache: ReviewCache | null = null;

const STUDENTS_TTL_MS = 5 * 60_000;
const REVIEW_TTL_MS = 5 * 60_000;
const STUDENTS_STORAGE_KEY = "fitclub_coach_students_v1";
const REVIEW_STORAGE_KEY = "fitclub_coach_review_v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readStorage<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode — memory cache still works.
  }
}

export function readStudentsCache(email: string): StudentsCache | null {
  const fresh =
    studentsCache &&
    studentsCache.email === email &&
    Date.now() - studentsCache.at <= STUDENTS_TTL_MS
      ? studentsCache
      : null;
  if (fresh) return fresh;

  const stored = readStorage<StudentsCache>(STUDENTS_STORAGE_KEY);
  if (
    stored &&
    stored.email === email &&
    Date.now() - stored.at <= STUDENTS_TTL_MS
  ) {
    studentsCache = stored;
    return stored;
  }
  return null;
}

export function writeStudentsCache(entry: Omit<StudentsCache, "at">): void {
  studentsCache = { ...entry, at: Date.now() };
  writeStorage(STUDENTS_STORAGE_KEY, studentsCache);
}

export function readReviewCache(
  email: string,
  logIdsKey: string
): ReviewCache | null {
  const match = (item: ReviewCache | null): ReviewCache | null => {
    if (!item || item.email !== email) return null;
    if (Date.now() - item.at > REVIEW_TTL_MS) return null;
    if (item.logIdsKey !== logIdsKey) return null;
    return item;
  };

  const fresh = match(reviewCache);
  if (fresh) return fresh;

  const stored = match(readStorage<ReviewCache>(REVIEW_STORAGE_KEY));
  if (stored) {
    reviewCache = stored;
    return stored;
  }
  return null;
}

export function writeReviewCache(entry: Omit<ReviewCache, "at">): void {
  reviewCache = { ...entry, at: Date.now() };
  writeStorage(REVIEW_STORAGE_KEY, reviewCache);
}

export function reviewLogIdsKey(ids: string[]): string {
  return ids.join("|");
}
