import {
  fetchUserByEmailForAuth,
  filterStudentsForSession,
} from "@/lib/db";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import type { RegistryUser, UserPlan, UserSession } from "@/lib/types";

export type { UserPlan };

/** Free 教練最多可管理學員數；Pro 教練無上限 */
export const FREE_COACH_STUDENT_LIMIT = 5;

const PRO_PLAN_EMAILS = buildProEmailAllowlist();

function buildProEmailAllowlist(): Set<string> {
  const set = new Set([SUPER_ADMIN_EMAIL.trim().toLowerCase()]);
  const extra = process.env.PRO_EMAIL_ALLOWLIST?.split(",") ?? [];
  for (const raw of extra) {
    const email = raw.trim().toLowerCase();
    if (email) set.add(email);
  }
  return set;
}

export function normalizeUserPlan(value: unknown): UserPlan {
  return value === "pro" ? "pro" : "free";
}

export function resolveIsPro(input: {
  email: string;
  role: UserSession["role"];
  plan?: UserPlan | string | null;
  isPro?: boolean;
}): boolean {
  if (input.isPro === true) return true;
  if (input.role === "admin") return true;
  const email = input.email.trim().toLowerCase();
  if (PRO_PLAN_EMAILS.has(email)) return true;
  return normalizeUserPlan(input.plan) === "pro";
}

export function isCoachPro(
  session: Pick<UserSession, "email" | "role" | "plan" | "isPro">
): boolean {
  return resolveIsPro({
    email: session.email,
    role: session.role,
    plan: session.plan,
    isPro: session.isPro,
  });
}

export function countCoachStudents(
  session: UserSession,
  registry: RegistryUser[]
): number {
  return filterStudentsForSession(session, registry).length;
}

export type CoachStudentLimitResult =
  | { ok: true; limit: number | null; current: number }
  | { ok: false; error: string; limit: number; current: number };

export function checkCoachStudentLimit(
  session: UserSession,
  registry: RegistryUser[]
): CoachStudentLimitResult {
  const current = countCoachStudents(session, registry);

  if (session.role === "admin") {
    return { ok: true, limit: null, current };
  }

  if (session.role !== "coach") {
    return {
      ok: false,
      error: "僅教練可新增學員",
      limit: FREE_COACH_STUDENT_LIMIT,
      current,
    };
  }

  if (isCoachPro(session)) {
    return { ok: true, limit: null, current };
  }

  if (current >= FREE_COACH_STUDENT_LIMIT) {
    return {
      ok: false,
      error: `Free 版最多 ${FREE_COACH_STUDENT_LIMIT} 位學員。升級 Pro 教練可無限新增，旗下學員亦享有 Pro 功能。`,
      limit: FREE_COACH_STUDENT_LIMIT,
      current,
    };
  }

  return { ok: true, limit: FREE_COACH_STUDENT_LIMIT, current };
}

/** 學員 Pro = 自己 plan 為 pro，或所屬教練為 Pro */
export async function resolveEffectiveIsPro(
  session: UserSession,
  user?: RegistryUser | null
): Promise<boolean> {
  if (session.role === "admin") return true;

  const email = session.email.trim().toLowerCase();
  let registryUser = user;

  if (!registryUser) {
    try {
      registryUser = await fetchUserByEmailForAuth(email);
    } catch (err) {
      console.warn("[user-plan] fetch user failed:", err);
    }
  }

  if (
    registryUser &&
    resolveIsPro({
      email: registryUser.email,
      role: registryUser.role,
      plan: registryUser.plan,
    })
  ) {
    return true;
  }

  if (
    resolveIsPro({
      email,
      role: session.role,
      plan: session.plan ?? registryUser?.plan,
      isPro: session.isPro,
    })
  ) {
    return true;
  }

  if (registryUser?.role === "student" || session.role === "student") {
    const coachEmail =
      registryUser?.addedBy?.trim().toLowerCase() ??
      session.addedBy?.trim().toLowerCase();
    if (coachEmail) {
      try {
        const coach = await fetchUserByEmailForAuth(coachEmail);
        if (
          coach &&
          resolveIsPro({
            email: coach.email,
            role: coach.role,
            plan: coach.plan,
          })
        ) {
          return true;
        }
      } catch (err) {
        console.warn("[user-plan] coach plan lookup failed:", err);
      }
    }
  }

  return false;
}

export function applyUserPlanToSession(
  session: UserSession,
  user?: Pick<RegistryUser, "plan" | "email"> | null
): UserSession {
  const plan = normalizeUserPlan(user?.plan ?? session.plan);
  const isPro =
    session.isPro === true
      ? true
      : resolveIsPro({
          email: session.email,
          role: session.role,
          plan,
        });
  return { ...session, plan, isPro };
}

export async function applyEffectivePlanToSession(
  session: UserSession,
  user?: RegistryUser | null
): Promise<UserSession> {
  const plan = normalizeUserPlan(user?.plan ?? session.plan);
  const isPro = await resolveEffectiveIsPro(session, user);
  return { ...session, plan, isPro };
}

export async function resolveIsProForSession(
  session: UserSession
): Promise<boolean> {
  return resolveEffectiveIsPro(session);
}

export class ProRequiredError extends Error {
  constructor() {
    super("PRO_REQUIRED");
    this.name = "ProRequiredError";
  }
}

export async function assertProSession(
  session: UserSession | null
): Promise<UserSession> {
  if (!session?.email) throw new ProRequiredError();
  const ok = await resolveEffectiveIsPro(session);
  if (!ok) throw new ProRequiredError();
  return session;
}
