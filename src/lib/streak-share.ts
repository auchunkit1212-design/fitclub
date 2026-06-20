import { BRAND_NAME } from "@/lib/brand";
import { publishThoughtPostCloud } from "@/lib/community-client";
import type { UserSession } from "@/lib/types";

export function buildStreakShareMessage(input: {
  currentStreak: number;
  longestStreak?: number;
  studentName?: string;
  origin?: string;
}): string {
  const name = input.studentName?.trim();
  const streak = Math.max(1, Math.round(input.currentStreak));
  const longest = Math.max(streak, Math.round(input.longestStreak ?? streak));
  const url = input.origin?.replace(/\/$/, "") || "";

  const headline = name
    ? `${name} 喺 ${BRAND_NAME} 已連續打卡 ${streak} 天！🔥`
    : `我已喺 ${BRAND_NAME} 連續打卡 ${streak} 天！🔥`;

  const lines = [
    headline,
    longest > streak
      ? `最長紀錄 ${longest} 天，繼續衝！`
      : "自律嘅人，值得被看見 💪",
    url ? `一齊記錄飲食：${url}` : undefined,
  ].filter(Boolean);

  return lines.join("\n");
}

export async function copyShareText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

export async function shareStreakExternally(input: {
  currentStreak: number;
  longestStreak?: number;
  studentName?: string;
  origin?: string;
}): Promise<"shared" | "copied" | "failed"> {
  const text = buildStreakShareMessage(input);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: `${BRAND_NAME} 連續打卡 ${input.currentStreak} 天`,
        text,
        url: input.origin,
      });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "failed";
    }
  }

  const copied = await copyShareText(text);
  return copied ? "copied" : "failed";
}

export async function publishStreakToCommunity(input: {
  session: Pick<UserSession, "email" | "name" | "tenantId">;
  currentStreak: number;
  longestStreak?: number;
  origin?: string;
}): Promise<void> {
  const bodyText = buildStreakShareMessage({
    currentStreak: input.currentStreak,
    longestStreak: input.longestStreak,
    studentName: input.session.name,
    origin: input.origin,
  });

  await publishThoughtPostCloud({
    session: input.session,
    bodyText,
  });
}
