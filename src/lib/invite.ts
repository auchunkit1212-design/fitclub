import { BRAND_NAME } from "@/lib/brand";

/** 學員註冊頁邀請連結（帶入邀請碼） */
export function buildCoachInviteRegisterPath(code: string): string {
  return `/register?invite=${encodeURIComponent(code.trim())}`;
}

export function buildCoachInviteRegisterUrl(
  code: string,
  origin?: string
): string {
  const path = buildCoachInviteRegisterPath(code);
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function buildInviteCodeMessage(
  code: string,
  brandName?: string
): string {
  const label = brandName?.trim() || "教練";
  return `下載 ${BRAND_NAME} App，註冊時輸入我的專屬邀請碼：${code.trim()}，加入「${label}」飲食打卡！🦍`;
}

export function buildInviteLinkMessage(
  code: string,
  registerUrl: string,
  brandName?: string
): string {
  const label = brandName?.trim() || "教練";
  return `加入「${label}」飲食打卡 👇\n${registerUrl}\n\n（或註冊時輸入邀請碼：${code.trim()}）`;
}
