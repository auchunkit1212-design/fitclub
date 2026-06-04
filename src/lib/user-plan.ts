import { fetchUserByEmailForAuth } from "@/lib/db";
import { SUPER_ADMIN_EMAIL } from "@/lib/registry-constants";
import type { RegistryUser, UserPlan, UserSession } from "@/lib/types";

export type { UserPlan };

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

export function applyUserPlanToSession(
  session: UserSession,
  user?: Pick<RegistryUser, "plan" | "email"> | null
): UserSession {
  const plan = normalizeUserPlan(user?.plan ?? session.plan);
  const isPro = resolveIsPro({
    email: session.email,
    role: session.role,
    plan,
  });
  return { ...session, plan, isPro };
}

export async function resolveIsProForSession(
  session: UserSession
): Promise<boolean> {
  if (
    resolveIsPro({
      email: session.email,
      role: session.role,
      plan: session.plan,
      isPro: session.isPro,
    })
  ) {
    return true;
  }
  if (session.role === "admin") return true;
  try {
    const user = await fetchUserByEmailForAuth(session.email);
    if (!user) return false;
    return resolveIsPro({
      email: user.email,
      role: user.role,
      plan: user.plan,
    });
  } catch (err) {
    console.warn("[user-plan] resolve failed:", err);
    return false;
  }
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
  const ok = await resolveIsProForSession(session);
  if (!ok) throw new ProRequiredError();
  return session;
}
