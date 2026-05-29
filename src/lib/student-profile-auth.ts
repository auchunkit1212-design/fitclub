import { fetchUserByEmail } from "@/lib/db";
import type { UserSession } from "@/lib/types";

export type StudentProfileAuthDebug = {
  hasSession: boolean;
  sessionEmail?: string;
  sessionRole?: string;
  registryRole?: string;
  cookiePresent: boolean;
  effectiveRole?: string;
};

export type StudentProfileAuthResult =
  | { ok: true; email: string; session: UserSession; debug: StudentProfileAuthDebug }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
      debug: StudentProfileAuthDebug;
    };

/** 與首頁一致：非 coach/admin 視為學員；並以 users_registry 校正 role */
export async function resolveEffectiveRole(
  session: UserSession
): Promise<"student" | "coach" | "admin"> {
  if (session.role === "coach" || session.role === "admin") {
    return session.role;
  }
  if (session.role === "student") return "student";

  const user = await fetchUserByEmail(session.email);
  if (user?.role === "coach") return "coach";
  return "student";
}

export async function authorizeStudentProfileUpdate(
  session: UserSession | null,
  options?: { cookiePresent?: boolean; bodyEmail?: string }
): Promise<StudentProfileAuthResult> {
  const debug: StudentProfileAuthDebug = {
    hasSession: Boolean(session?.email),
    sessionEmail: session?.email,
    sessionRole: session?.role,
    cookiePresent: options?.cookiePresent ?? false,
  };

  if (!session?.email) {
    return {
      ok: false,
      status: 401,
      error: "未登入，請重新登入後再試。",
      code: "NO_SESSION",
      debug,
    };
  }

  const email = session.email.trim().toLowerCase();
  if (
    options?.bodyEmail &&
    options.bodyEmail.trim().toLowerCase() !== email
  ) {
    return {
      ok: false,
      status: 403,
      error: "電郵與登入帳號不符。",
      code: "EMAIL_MISMATCH",
      debug,
    };
  }

  const user = await fetchUserByEmail(email);
  debug.registryRole = user?.role;

  const effectiveRole = await resolveEffectiveRole(session);
  debug.effectiveRole = effectiveRole;

  if (effectiveRole !== "student") {
    return {
      ok: false,
      status: 403,
      error: "僅學員可更新身體檔案。",
      code: "NOT_STUDENT",
      debug,
    };
  }

  return {
    ok: true,
    email,
    session: {
      ...session,
      email,
      role: "student",
      isLoggedIn: true,
    },
    debug,
  };
}
