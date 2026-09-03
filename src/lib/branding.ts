import { fetchCoachByName, fetchCoachByTenantId } from "@/lib/db-coach-lookup";
import { safeBrandLogo } from "@/lib/session-sanitize";
import { fetchTenantById } from "@/lib/tenant";
import type {
  CoachBranding,
  RegistryUser,
  Tenant,
  UserSession,
} from "@/lib/types";
import { DEFAULT_BRANDING } from "@/lib/types";

export interface ResolvedBrand {
  branding: CoachBranding;
  broadcast: string;
  gymName: string;
  tenantSlug?: string;
}

function resolveBrandingLogo(
  ...candidates: (string | null | undefined)[]
): string | undefined {
  for (const raw of candidates) {
    const safe = safeBrandLogo(raw);
    if (safe) return safe;
  }
  return undefined;
}

export function brandingFromTenant(tenant: Tenant): ResolvedBrand {
  return {
    gymName: tenant.gymName,
    tenantSlug: tenant.slug,
    broadcast: "",
    branding: {
      appTitle: tenant.gymName,
      themeColor: "emerald",
      logo: resolveBrandingLogo(tenant.logoUrl),
    },
  };
}

export function brandingFromCoach(coach: RegistryUser): ResolvedBrand {
  return {
    gymName: coach.appTitle ?? coach.gym,
    broadcast: coach.broadcast ?? "",
    branding: {
      appTitle: coach.appTitle ?? coach.gym ?? DEFAULT_BRANDING.appTitle,
      themeColor: coach.themeColor ?? DEFAULT_BRANDING.themeColor,
      logo: resolveBrandingLogo(coach.logo),
    },
  };
}

export async function resolveBrandForUser(
  session: UserSession,
  registry: RegistryUser[]
): Promise<ResolvedBrand> {
  if (session.tenantId) {
    const tenant = await fetchTenantById(session.tenantId);
    if (tenant) {
      const coach = registry.find(
        (u) => u.role === "coach" && u.tenantId === tenant.id
      );
      const base = brandingFromTenant(tenant);
      if (coach?.logo) {
        base.branding.logo = coach.logo;
      }
      if (coach?.themeColor) {
        base.branding.themeColor = coach.themeColor;
      }
      if (coach?.broadcast) {
        base.broadcast = coach.broadcast;
      }
      return base;
    }
  }

  let coachRow: RegistryUser | undefined;
  if (session.role === "coach") {
    coachRow = registry.find((u) => u.email === session.email);
  } else if (session.role === "student" && session.coach) {
    coachRow = registry.find(
      (u) => u.role === "coach" && u.name === session.coach
    );
  } else {
    coachRow = registry.find((u) => u.role === "coach");
  }

  if (!coachRow) {
    return {
      gymName: session.gym || DEFAULT_BRANDING.appTitle,
      broadcast: "",
      branding: DEFAULT_BRANDING,
    };
  }

  return brandingFromCoach(coachRow);
}

/** 登入專用：輕量查詢，避免 fetchAllUsers 拖慢或逾時 */
export async function resolveBrandForLogin(
  session: UserSession,
  user: RegistryUser
): Promise<ResolvedBrand> {
  if (user.tenantId) {
    const tenant = await fetchTenantById(user.tenantId);
    if (tenant) {
      const base = brandingFromTenant(tenant);
      const coach = await fetchCoachByTenantId(user.tenantId);
      if (coach?.logo) base.branding.logo = coach.logo;
      if (coach?.themeColor) base.branding.themeColor = coach.themeColor;
      if (coach?.broadcast) base.broadcast = coach.broadcast;
      return base;
    }
  }

  if (user.role === "coach") {
    return brandingFromCoach(user);
  }

  if (user.coach) {
    const coach = await fetchCoachByName(user.coach);
    if (coach) return brandingFromCoach(coach);
  }

  return {
    gymName: user.appTitle ?? user.gym ?? session.gym ?? DEFAULT_BRANDING.appTitle,
    broadcast: user.broadcast ?? "",
    branding: {
      appTitle: user.appTitle ?? user.gym ?? DEFAULT_BRANDING.appTitle,
      themeColor: user.themeColor ?? DEFAULT_BRANDING.themeColor,
      logo: resolveBrandingLogo(user.logo),
    },
  };
}

export function applyBrandToSession(
  session: UserSession,
  brand: ResolvedBrand
): UserSession {
  return {
    ...session,
    brandName: brand.gymName,
    brandLogo: brand.branding.logo,
    tenantSlug: brand.tenantSlug ?? session.tenantSlug,
    gym: brand.gymName,
  };
}
