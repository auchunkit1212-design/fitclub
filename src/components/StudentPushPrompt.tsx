"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Bell, Droplets, IconLabel, Megaphone, Moon } from "@/components/icons";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import type { PersonalSettings } from "@/lib/personal-settings";

const SESSION_SNOOZE_KEY = "fitclub_push_prompt_snoozed";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface StudentPushPromptProps {
  reminderSettings?: PersonalSettings;
  onSettingsSync?: (settings: PersonalSettings) => Promise<boolean>;
}

export function StudentPushPrompt({
  reminderSettings,
  onSettingsSync,
}: StudentPushPromptProps) {
  const { t } = useI18n();
  const {
    status,
    setMessage,
    supported,
    permission,
    initialized,
    enable,
    refresh,
  } = usePushSubscription();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!initialized) return;

    if (!supported || status === "enabled" || status === "unsupported") {
      setVisible(false);
      return;
    }

    if (sessionStorage.getItem(SESSION_SNOOZE_KEY) === "1") {
      setVisible(false);
      return;
    }

    setVisible(true);
  }, [initialized, supported, status]);

  const handleEnable = async () => {
    setEnabling(true);
    const result = await enable();
    setEnabling(false);
    if (result.ok) {
      if (reminderSettings && onSettingsSync) {
        await onSettingsSync(reminderSettings);
      }
      sessionStorage.removeItem(SESSION_SNOOZE_KEY);
      setVisible(false);
      return;
    }
    setMessage(result.error);
    await refresh();
  };

  const handleLater = () => {
    sessionStorage.setItem(SESSION_SNOOZE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  const denied = permission === "denied" || status === "denied";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-prompt-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-5 py-5 text-white">
          <p id="push-prompt-title" className="text-lg font-bold">
            <IconLabel icon={Bell} iconClassName="text-white">
              {t("push.prompt.title", "開啟 App 通知")}
            </IconLabel>
          </p>
          <p className="mt-2 text-sm text-emerald-50/95 leading-relaxed">
            {t(
              "push.prompt.subtitle",
              "教練提醒、飲水同飲食打卡都會喺鎖屏通知你，就算閂咗 App 都唔會錯過。"
            )}
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <ul className="text-xs text-zinc-600 space-y-1.5 leading-relaxed">
            <li className="flex items-start gap-2">
              <Droplets size={16} strokeWidth={2} className="shrink-0 text-emerald-600 mt-0.5" aria-hidden />
              {t("push.prompt.bullet1", "朝早飲水 + 記錄飲食提醒")}
            </li>
            <li className="flex items-start gap-2">
              <Megaphone size={16} strokeWidth={2} className="shrink-0 text-emerald-600 mt-0.5" aria-hidden />
              {t("push.prompt.bullet2", "教練遠端催促你打卡")}
            </li>
            <li className="flex items-start gap-2">
              <Moon size={16} strokeWidth={2} className="shrink-0 text-emerald-600 mt-0.5" aria-hidden />
              {t("push.prompt.bullet3", "每晚總結你今日進度")}
            </li>
          </ul>

          {denied ? (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 leading-relaxed">
              {t(
                "push.prompt.denied",
                "你之前拒絕咗通知。請去 設定 → 此 App / Safari → 通知 → 允許，然後重新開啟 App。"
              )}
            </p>
          ) : null}

          <button
            type="button"
            disabled={enabling || denied}
            onClick={handleEnable}
            className={`w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50 ${btnClass}`}
          >
            {enabling
              ? t("push.processing", "處理緊...")
              : t("push.prompt.enable", "立即開啟通知")}
          </button>

          <button
            type="button"
            onClick={handleLater}
            className={`w-full py-3 rounded-xl text-zinc-500 text-sm font-medium ${btnClass}`}
          >
            {t("push.prompt.later", "稍後再說")}
          </button>
        </div>
      </div>
    </div>
  );
}
