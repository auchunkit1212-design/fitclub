import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { fetchUserByEmailForAuth } from "@/lib/db";
import type { RegistryUser, UserPlan, UserSession } from "@/lib/types";

export type { UserPlan };

function buildProEmailAllowlist(): Set<string> {
  const set = new Set([SUPER_ADMIN_EMAIL.trim().toLowerCase()]);
  const extra = process.env.PRO_EMAIL_ALLOWLIST?.split(",") ?? [];
  for (const raw of extra) {
    const email = raw.trim().toLowerCase();
    if (email) set.add(email);
  }
  return set;
}

const PRO_PLAN_EMAILS = buildProEmailAllowlist();

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

/** 學員 Pro = 自己 plan 為 pro，或所屬教練為 Pro（同主 app） */
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

export async function applyEffectivePlanToSession(
  session: UserSession,
  user?: RegistryUser | null
): Promise<UserSession> {
  const plan = normalizeUserPlan(user?.plan ?? session.plan);
  const isPro = await resolveEffectiveIsPro(session, user);
  return { ...session, plan, isPro };
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
