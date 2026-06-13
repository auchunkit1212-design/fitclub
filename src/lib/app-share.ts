import { BRAND_TAGLINE } from "@/lib/brand";
import {
  buildCoachInviteRegisterUrl,
  buildInviteLinkMessage,
} from "@/lib/invite";
import { AI_SOLO_TENANT_SLUG } from "@/lib/registry-constants";
import type { UserSession } from "@/lib/types";

export type StudentShareMode = "coach" | "solo";

export function resolveStudentShareMode(
  session: Pick<UserSession, "tenantSlug" | "addedBy">
): StudentShareMode {
  const slug = session.tenantSlug?.trim();
  if (slug && slug !== AI_SOLO_TENANT_SLUG && session.addedBy?.trim()) {
    return "coach";
  }
  return "solo";
}

export function buildStudentRegisterUrl(origin?: string): string {
  const path = "/register";
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function buildStudentShareUrl(
  session: Pick<UserSession, "tenantSlug" | "addedBy" | "gym" | "brandName">,
  origin?: string
): { url: string; mode: StudentShareMode; inviteCode?: string } {
  const mode = resolveStudentShareMode(session);
  if (mode === "coach" && session.tenantSlug) {
    const code = session.tenantSlug.trim();
    return {
      url: buildCoachInviteRegisterUrl(code, origin),
      mode,
      inviteCode: code,
    };
  }
  return { url: buildStudentRegisterUrl(origin), mode: "solo" };
}

export function buildStudentShareMessage(input: {
  url: string;
  mode: StudentShareMode;
  inviteCode?: string;
  gymName?: string;
  sharerName?: string;
}): string {
  const gym = input.gymName?.trim();
  const name = input.sharerName?.trim();

  if (input.mode === "coach" && input.inviteCode) {
    return buildInviteLinkMessage(
      input.inviteCode,
      input.url,
      gym || "教練"
    );
  }

  const intro = name
    ? `${name} 介紹你用 ${BRAND_TAGLINE} 記錄飲食同 AI 分析：`
    : `一齊用 ${BRAND_TAGLINE} 記錄飲食、AI 分析營養：`;

  return `${intro}\n${input.url}`;
}
