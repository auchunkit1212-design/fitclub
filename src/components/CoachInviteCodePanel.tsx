"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  buildCoachInviteRegisterUrl,
  buildInviteCodeMessage,
  buildInviteLinkMessage,
} from "@/lib/invite";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

async function copyText(text: string): Promise<boolean> {
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

interface CoachInviteCodePanelProps {
  inviteCode: string;
  brandName?: string;
  loading?: boolean;
  onCopied: (message: string) => void;
}

export function CoachInviteCodePanel({
  inviteCode,
  brandName,
  loading = false,
  onCopied,
}: CoachInviteCodePanelProps) {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");

  const code = inviteCode.trim();
  const hasCode = code.length > 0;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const registerUrl = useMemo(() => {
    if (!hasCode) return "";
    return buildCoachInviteRegisterUrl(code, origin || undefined);
  }, [code, hasCode, origin]);

  const handleCopy = async (text: string, successMsg: string) => {
    const ok = await copyText(text);
    onCopied(ok ? successMsg : t("invite.copyFailed", "複製失敗，請長按手動複製"));
  };

  return (
    <section className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 p-4 shadow-sm space-y-4">
      <div>
        <h2 className="font-bold text-amber-900 text-base">
          {t("invite.coach.title", "🔗 學員邀請 · 邀請碼 / 連結")}
        </h2>
        <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
          {t(
            "invite.coach.hint",
            "分享邀請碼或連結俾學員，佢哋註冊時會自動加入你嘅品牌空間。"
          )}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-amber-800/70 animate-pulse">
          {t("invite.coach.loading", "載入邀請資料中...")}
        </p>
      ) : !hasCode ? (
        <div className="rounded-xl bg-white/80 border border-amber-200 px-3 py-3 text-xs text-amber-900 leading-relaxed">
          {t(
            "invite.coach.noCode",
            "暫時未有邀請碼。請先完成品牌開通（SAS 註冊）或聯絡總控為你綁定 Tenant；發布品牌設定後會顯示專屬邀請碼。"
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
              {t("invite.coach.codeLabel", "專屬邀請碼")}
            </p>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 rounded-xl bg-white border border-amber-200 px-3 py-2.5">
                <p className="font-mono text-lg font-black text-zinc-900 truncate select-all">
                  {code}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy(code, t("invite.coach.copiedCode", "✅ 已複製邀請碼"))
                }
                className={`shrink-0 px-3 rounded-xl bg-amber-500 text-white text-xs font-bold ${btnClass}`}
              >
                {t("invite.coach.copyCode", "複製碼")}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
              {t("invite.coach.linkLabel", "邀請連結")}
            </p>
            <div className="rounded-xl bg-white border border-amber-200 px-3 py-2.5">
              <p className="text-xs text-zinc-700 break-all leading-relaxed select-all">
                {registerUrl}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    registerUrl,
                    t("invite.coach.copiedLink", "✅ 已複製邀請連結")
                  )
                }
                className={`flex-1 min-w-[7rem] py-2.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold ${btnClass}`}
              >
                {t("invite.coach.copyLink", "📎 複製連結")}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    buildInviteLinkMessage(code, registerUrl, brandName),
                    t("invite.coach.copiedShare", "✅ 已複製分享文案（連結+碼）")
                  )
                }
                className={`flex-1 min-w-[7rem] py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold ${btnClass}`}
              >
                {t("invite.coach.copyShare", "📲 複製分享文案")}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              handleCopy(
                buildInviteCodeMessage(code, brandName),
                t("invite.coach.copiedMessage", "✅ 已複製邀請碼文案")
              )
            }
            className={`w-full py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold ${btnClass}`}
          >
            {t("invite.coach.copyCodeMessage", "📋 複製邀請碼文案（WhatsApp）")}
          </button>
        </>
      )}
    </section>
  );
}
