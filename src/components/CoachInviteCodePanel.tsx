"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  ClipboardList,
  IconLabel,
  Link,
  Paperclip,
  Smartphone,
} from "@/components/icons";
import {
  buildCoachInviteRegisterUrl,
  buildInviteCodeMessage,
  buildInviteLinkMessage,
} from "@/lib/invite";
import { SOFT_CARD } from "@/lib/ui-tokens";

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
    <section className={`${SOFT_CARD} p-5 space-y-4`}>
      <div>
        <h2 className="font-semibold text-gray-900 text-base">
          <IconLabel icon={Link} iconClassName="text-emerald-600">
            {t("invite.coach.title", "邀請學員")}
          </IconLabel>
        </h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          {t(
            "invite.coach.hint",
            "分享邀請碼或連結俾學員，註冊後會自動加入你嘅健身室。"
          )}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 animate-pulse">
          {t("invite.coach.loading", "載入邀請資料中...")}
        </p>
      ) : !hasCode ? (
        <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-xs text-gray-600 leading-relaxed">
          {t(
            "invite.coach.noCode",
            "暫時未有邀請碼。去「品牌」頁填好健身室名稱並儲存，就會自動產生邀請碼。"
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-gray-500">
              {t("invite.coach.codeLabel", "邀請碼")}
            </p>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="font-mono text-xl font-semibold text-gray-900 truncate select-all">
                  {code}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy(code, t("invite.coach.copiedCode", "已複製邀請碼"))
                }
                className={`shrink-0 px-4 rounded-2xl bg-emerald-600 text-white text-sm font-semibold ${btnClass}`}
              >
                {t("invite.coach.copyCode", "複製")}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-gray-500">
              {t("invite.coach.linkLabel", "邀請連結")}
            </p>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-xs text-gray-600 break-all leading-relaxed select-all">
                {registerUrl}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    registerUrl,
                    t("invite.coach.copiedLink", "已複製邀請連結")
                  )
                }
                className={`py-3 rounded-2xl bg-zinc-100 text-gray-800 text-xs font-semibold ${btnClass}`}
              >
                <IconLabel icon={Paperclip} size="sm" iconClassName="text-gray-700">
                  {t("invite.coach.copyLink", "複製連結")}
                </IconLabel>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    buildInviteLinkMessage(code, registerUrl, brandName),
                    t("invite.coach.copiedShare", "已複製分享文案（連結+碼）")
                  )
                }
                className={`py-3 rounded-2xl bg-zinc-900 text-white text-xs font-semibold ${btnClass}`}
              >
                <IconLabel icon={Smartphone} size="sm" iconClassName="text-white">
                  {t("invite.coach.copyShare", "分享文案")}
                </IconLabel>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              handleCopy(
                buildInviteCodeMessage(code, brandName),
                t("invite.coach.copiedMessage", "已複製邀請碼文案")
              )
            }
            className={`w-full py-3 rounded-2xl border border-zinc-200 text-gray-700 text-xs font-medium ${btnClass}`}
          >
            <IconLabel icon={ClipboardList} size="sm" className="justify-center" iconClassName="text-gray-600">
              {t("invite.coach.copyCodeMessage", "複製 WhatsApp 邀請字")}
            </IconLabel>
          </button>
        </>
      )}
    </section>
  );
}
