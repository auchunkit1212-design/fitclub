"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { IconLabel, Link, Smartphone } from "@/components/icons";
import {
  buildStudentShareMessage,
  buildStudentShareUrl,
} from "@/lib/app-share";
import type { UserSession } from "@/lib/types";

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

type Props = {
  session: UserSession;
  onCopied: (message: string) => void;
};

export function StudentShareAppPanel({ session, onCopied }: Props) {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const share = useMemo(
    () => buildStudentShareUrl(session, origin || undefined),
    [session, origin]
  );

  const shareMessage = useMemo(
    () =>
      buildStudentShareMessage({
        url: share.url,
        mode: share.mode,
        inviteCode: share.inviteCode,
        gymName: session.brandName || session.gym,
        sharerName: session.name,
      }),
    [share, session.brandName, session.gym, session.name]
  );

  const handleCopy = async (text: string, successMsg: string) => {
    const ok = await copyText(text);
    onCopied(
      ok ? successMsg : t("share.copyFailed", "複製失敗，請長按手動複製")
    );
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: t("share.student.title", "分享 App 俾朋友"),
          text: shareMessage,
          url: share.url,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    await handleCopy(
      shareMessage,
      t("share.student.copiedMessage", "已複製分享文案")
    );
  };

  return (
    <section className="rounded-3xl bg-gradient-to-br from-sky-50 to-emerald-50 border border-sky-200 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">
          <IconLabel icon={Link} iconClassName="text-sky-700">
            {t("share.student.title", "分享 App 俾朋友")}
          </IconLabel>
        </h2>
        <p className="text-xs text-zinc-500 leading-relaxed mt-1">
          {share.mode === "coach"
            ? t(
                "share.student.hintCoach",
                "分享連結俾朋友，佢哋註冊後會自動加入你同一個教練／健身室。"
              )
            : t(
                "share.student.hintSolo",
                "分享連結俾朋友，一齊用 AI 記錄飲食同分析營養。"
              )}
        </p>
      </div>

      <div className="rounded-xl bg-white border border-sky-100 px-3 py-2.5">
        <p className="text-xs text-zinc-700 break-all leading-relaxed select-all">
          {share.url}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            void handleCopy(
              share.url,
              t("share.student.copiedLink", "已複製連結")
            )
          }
          className={`flex-1 min-w-[7rem] py-2.5 rounded-xl bg-white border border-sky-200 text-sky-900 text-xs font-bold ${btnClass}`}
        >
          {t("share.student.copyLink", "複製連結")}
        </button>
        <button
          type="button"
          onClick={() =>
            void handleCopy(
              shareMessage,
              t("share.student.copiedMessage", "已複製分享文案")
            )
          }
          className={`flex-1 min-w-[7rem] py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold ${btnClass}`}
        >
          <IconLabel icon={Smartphone} size="sm" iconClassName="text-white">
            {t("share.student.copyMessage", "複製文案")}
          </IconLabel>
        </button>
      </div>

      <button
        type="button"
        onClick={() => void handleNativeShare()}
        className={`w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold ${btnClass}`}
      >
        {t("share.student.shareButton", "分享俾朋友")}
      </button>
    </section>
  );
}
