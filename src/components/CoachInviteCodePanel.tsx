"use client";

import { BRAND_NAME } from "@/lib/brand";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

function buildInviteMessage(code: string): string {
  return `下載 ${BRAND_NAME} App，註冊時輸入我的專屬邀請碼：${code}，讓我親自為你批閱飲食！🦍`;
}

interface CoachInviteCodePanelProps {
  inviteCode: string;
  onCopied: (message: string) => void;
}

export function CoachInviteCodePanel({
  inviteCode,
  onCopied,
}: CoachInviteCodePanelProps) {
  if (!inviteCode.trim()) return null;

  const copyInvite = async () => {
    const text = buildInviteMessage(inviteCode.trim());
    try {
      await navigator.clipboard.writeText(text);
      onCopied("已複製邀請碼！");
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
        onCopied("已複製邀請碼！");
      } catch {
        onCopied("複製失敗，請手動複製邀請碼");
      }
    }
  };

  return (
    <section className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 p-4 shadow-sm space-y-3">
      <div>
        <h2 className="font-bold text-amber-900 text-base">🎫 我的教練邀請碼</h2>
        <p className="text-xs text-amber-800/80 mt-1">
          分享俾學員，佢哋註冊時輸入即可加入你嘅品牌空間
        </p>
      </div>
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0 rounded-xl bg-white border border-amber-200 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
            專屬邀請碼
          </p>
          <p className="font-mono text-lg font-black text-zinc-900 truncate">
            {inviteCode}
          </p>
        </div>
        <button
          type="button"
          onClick={copyInvite}
          className={`shrink-0 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold ${btnClass}`}
        >
          📋 一鍵複製
        </button>
      </div>
      <p className="text-[11px] text-amber-900/70 leading-relaxed">
        複製內容包含完整邀請文案，可直接貼到 WhatsApp / IG 俾學員
      </p>
    </section>
  );
}
