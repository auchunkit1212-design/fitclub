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

export function brandingFromTenant(tenant: Tenant): ResolvedBrand {
  return {
    gymName: tenant.gymName,
    tenantSlug: tenant.slug,
    broadcast: "",
    branding: {
      appTitle: tenant.gymName,
      themeColor: "emerald",
      logo: tenant.logoUrl,
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
      logo: coach.logo,
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
