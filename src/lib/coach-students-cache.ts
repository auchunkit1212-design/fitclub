import type {
  MealLog,
  MealLogFeedback,
  MealLogReaction,
  RegistryUser,
} from "@/lib/types";

type StudentsCache = {
  email: string;
  registry: RegistryUser[];
  logs: MealLog[];
  students: RegistryUser[];
  at: number;
};

type ReviewCache = {
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

export function readStudentsCache(email: string): StudentsCache | null {
  if (!studentsCache || studentsCache.email !== email) return null;
  if (Date.now() - studentsCache.at > STUDENTS_TTL_MS) return null;
  return studentsCache;
}

export function writeStudentsCache(entry: Omit<StudentsCache, "at">): void {
  studentsCache = { ...entry, at: Date.now() };
}

export function readReviewCache(
  email: string,
  logIdsKey: string
): ReviewCache | null {
  if (!reviewCache || reviewCache.email !== email) return null;
  if (Date.now() - reviewCache.at > REVIEW_TTL_MS) return null;
  if (reviewCache.logIdsKey !== logIdsKey) return null;
  return reviewCache;
}

export function writeReviewCache(entry: Omit<ReviewCache, "at">): void {
  reviewCache = { ...entry, at: Date.now() };
}

export function reviewLogIdsKey(ids: string[]): string {
  return ids.join("|");
}
