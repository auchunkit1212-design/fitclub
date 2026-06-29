"use client";

import { useEffect, useMemo, useState } from "react";
import { GorillaMascot } from "@/components/GorillaMascot";
import { StreakTemplatePicker } from "@/components/StreakTemplatePicker";
import { Download, Flame, Smartphone, Sparkles, Users } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import {
  getStreakCardTemplate,
  getStreakTemplateMeta,
  setStreakCardTemplate,
  type StreakCardTemplateId,
} from "@/lib/streak-templates";
import {
  createStreakShareImage,
  publishStreakToCommunity,
  saveStreakShareImage,
  shareStreakExternally,
} from "@/lib/streak-share";
import type { UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface StreakMilestoneModalProps {
  days: number;
  isSpecialMilestone?: boolean;
  session?: UserSession | null;
  longestStreak?: number;
  onClose: () => void;
  onNotify?: (message: string) => void;
}

export function StreakMilestoneModal({
  days,
  isSpecialMilestone = false,
  session,
  longestStreak,
  onClose,
  onNotify,
}: StreakMilestoneModalProps) {
  const { t } = useI18n();
  const [sharing, setSharing] = useState<"social" | "community" | "save" | null>(
    null
  );
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [templateId, setTemplateId] = useState<StreakCardTemplateId>(() =>
    getStreakCardTemplate()
  );

  const template = getStreakTemplateMeta(templateId);
  const isDarkModal = templateId === "midnight";

  const displayName = session?.name?.trim() || t("streak.guestName", "學員");

  const cardInput = useMemo(
    () => ({
      currentStreak: days,
      longestStreak,
      studentName: displayName,
      isSpecialMilestone,
      templateId,
    }),
    [days, longestStreak, displayName, isSpecialMilestone, templateId]
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setCardUrl(null);
    setCardBlob(null);

    void (async () => {
      try {
        const blob = await createStreakShareImage(cardInput);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCardBlob(blob);
        setCardUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setCardBlob(null);
          setCardUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cardInput]);

  const handleTemplateChange = (id: StreakCardTemplateId) => {
    setTemplateId(id);
    setStreakCardTemplate(id);
  };

  const notify = (message: string) => {
    onNotify?.(message);
  };

  const handleSaveImage = async () => {
    setSharing("save");
    try {
      if (cardBlob) {
        const { downloadStreakCard } = await import("@/lib/streak-card");
        downloadStreakCard(cardBlob, days);
      } else {
        await saveStreakShareImage(cardInput);
      }
      notify(t("streak.share.savedImage", "已儲存打卡圖片"));
    } catch {
      notify(t("streak.share.failed", "分享失敗，請再試"));
    } finally {
      setSharing(null);
    }
  };

  const handleShareSocial = async () => {
    setSharing("social");
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const result = await shareStreakExternally({
        ...cardInput,
        origin,
        imageBlob: cardBlob ?? undefined,
      });
      if (result === "shared") {
        notify(t("streak.share.shared", "已開啟分享"));
      } else if (result === "copied") {
        notify(t("streak.share.savedImage", "已儲存打卡圖片"));
      } else {
        notify(t("streak.share.failed", "分享失敗，請再試"));
      }
    } finally {
      setSharing(null);
    }
  };

  const handleShareCommunity = async () => {
    if (!session?.email) {
      notify(t("streak.share.needLogin", "請先登入再分享"));
      return;
    }
    setSharing("community");
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      await publishStreakToCommunity({
        session,
        currentStreak: days,
        longestStreak,
        origin,
      });
      notify(t("streak.share.communityPosted", "已分享到 Community"));
    } catch {
      notify(t("streak.share.failed", "分享失敗，請再試"));
    } finally {
      setSharing(null);
    }
  };

  const title = isSpecialMilestone
    ? t("streak.milestone.title", "震撼！連續 {days} 天健康打卡", { days })
    : t("streak.celebration.title", "連續打卡 {days} 天！", { days });

  const body = isSpecialMilestone
    ? t(
        "streak.milestone.body",
        "大猩猩為你的自律點讚！你已經超越了 90% 正在減脂的學員，繼續保持！"
      )
    : t(
        "streak.celebration.body",
        "今日打卡成功！揀一款樣式，儲存圖片或分享俾朋友。"
      );

  const titleClass = isDarkModal ? "text-amber-50" : "text-zinc-900";
  const bodyClass = isDarkModal ? "text-slate-300" : "text-zinc-600";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-milestone-title"
    >
      <div
        className={`w-full max-w-md rounded-3xl shadow-[0_24px_80px_rgb(0,0,0,0.18)] p-6 sm:p-8 text-center space-y-4 max-h-[92vh] overflow-y-auto ${template.modal.shell}`}
      >
        <div className="flex justify-center">
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center ${template.modal.hero}`}
            >
              <Flame
                size={40}
                strokeWidth={2}
                className={
                  templateId === "midnight"
                    ? "text-amber-400 fill-amber-300"
                    : templateId === "minimal"
                      ? "text-emerald-600 fill-emerald-400"
                      : "text-orange-500 fill-orange-400"
                }
                aria-hidden
              />
            </div>
            <span
              className={`absolute -top-1 -right-1 text-xs font-bold px-2 py-0.5 rounded-full ${template.modal.badge}`}
            >
              {days}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p
            id="streak-milestone-title"
            className={`text-xl font-bold leading-snug ${titleClass}`}
          >
            {title}
          </p>
          <p className={`text-sm leading-relaxed ${bodyClass}`}>{body}</p>
        </div>

        <StreakTemplatePicker
          compact
          dark={isDarkModal}
          value={templateId}
          onChange={handleTemplateChange}
        />

        {cardUrl ? (
          <div className="rounded-2xl overflow-hidden border border-zinc-100/80 shadow-md bg-zinc-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardUrl}
              alt={t("streak.cardAlt", "連續打卡分享圖")}
              className="w-full h-auto block"
            />
          </div>
        ) : (
          <div className="flex justify-center py-4">
            <GorillaMascot size="md" />
          </div>
        )}

        <button
          type="button"
          disabled={sharing !== null}
          onClick={() => void handleSaveImage()}
          className={`w-full py-3 rounded-2xl font-bold text-sm ${template.modal.save} ${btnClass} disabled:opacity-60`}
        >
          <span className="inline-flex items-center justify-center gap-1.5">
            <Download size={16} aria-hidden />
            {sharing === "save"
              ? t("streak.share.saving", "儲存中…")
              : t("streak.share.saveImage", "儲存圖片")}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={sharing !== null}
            onClick={() => void handleShareSocial()}
            className={`py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm ${btnClass} disabled:opacity-60`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <Smartphone size={16} aria-hidden />
              {sharing === "social"
                ? t("streak.share.sharing", "分享中…")
                : t("streak.share.social", "分享")}
            </span>
          </button>
          <button
            type="button"
            disabled={sharing !== null}
            onClick={() => void handleShareCommunity()}
            className={`py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm ${btnClass} disabled:opacity-60`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <Users size={16} aria-hidden />
              {sharing === "community"
                ? t("streak.share.sharing", "分享中…")
                : t("streak.share.community", "Community")}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`w-full py-3.5 rounded-2xl font-bold text-base shadow-[0_8px_30px_rgb(5,150,105,0.2)] ${template.modal.cta} ${btnClass}`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Sparkles size={18} strokeWidth={2} aria-hidden />
            {t("streak.milestone.cta", "繼續努力")}
          </span>
        </button>
      </div>
    </div>
  );
}
