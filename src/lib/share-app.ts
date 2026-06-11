import { getSiteUrl } from "@/lib/legal-config";

export function getAppRegisterUrl(origin?: string): string {
  return `${getSiteUrl(origin)}/register`;
}

export function buildShareAppMessage(origin?: string): string {
  const url = getAppRegisterUrl(origin);
  return `我最近用緊 Coach! 呢個 AI 飲食教練 App，超好用！用呢條 Link 註冊仲有 3 日免費 Pro 版試用：${url}`;
}

export async function shareAppInvite(options?: {
  origin?: string;
  onCopied?: () => void;
}): Promise<"shared" | "copied" | "failed"> {
  const text = buildShareAppMessage(options?.origin);
  const url = getAppRegisterUrl(options?.origin);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "Coach! What to do?",
        text,
        url,
      });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return "failed";
      }
      // fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    options?.onCopied?.();
    return "copied";
  } catch {
    return "failed";
  }
}
