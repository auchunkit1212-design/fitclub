"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { IconLabel, Link } from "@/components/icons";
import { shareAppInvite } from "@/lib/share-app";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  variant?: "primary" | "outline";
  className?: string;
  onToast?: (message: string) => void;
};

export function ShareAppButton({
  variant = "outline",
  className = "",
  onToast,
}: Props) {
  const { t } = useI18n();
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const result = await shareAppInvite({
        origin,
        onCopied: () =>
          onToast?.(
            t("share.copied", "連結已複製到剪貼簿，快啲分享俾朋友！")
          ),
      });
      if (result === "failed") {
        onToast?.(t("share.failed", "無法分享，請稍後再試"));
      }
    } finally {
      setSharing(false);
    }
  };

  const base =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
      : "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";

  return (
    <button
      type="button"
      disabled={sharing}
      onClick={() => void handleShare()}
      className={`w-full font-semibold py-3 rounded-xl disabled:opacity-60 ${base} ${btnClass} ${className}`}
    >
      <IconLabel
        icon={Link}
        className="justify-center"
        iconClassName={variant === "primary" ? "text-white" : "text-emerald-700"}
      >
        {sharing
          ? t("share.sharing", "準備分享中...")
          : t("share.inviteFriends", "分享給朋友試用")}
      </IconLabel>
    </button>
  );
}
