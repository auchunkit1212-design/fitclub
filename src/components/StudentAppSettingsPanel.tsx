"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PushReminderToggle } from "@/components/PushReminderToggle";
import { Settings, IconLabel } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import {
  MORNING_REMINDER_TIME_OPTIONS,
  WATER_REMINDER_KEYS,
  normalizePersonalSettings,
  type PersonalSettings,
} from "@/lib/personal-settings";
import { syncReminderSettingsToServer } from "@/lib/reminder-settings-client";

const SOFT_CARD =
  "w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100";

const BRAND_BTN = "bg-emerald-600 hover:bg-emerald-700 text-white";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const WATER_LABEL_KEY: Record<
  PersonalSettings["waterReminder"],
  string
> = {
  "1h": "settings.water.every1h",
  "2h": "settings.water.every2h",
  "4h": "settings.water.every4h",
  off: "settings.water.off",
};

type Props = {
  settings: PersonalSettings;
  onSettingsChange: (next: PersonalSettings) => void;
  onSaved: (message: string) => void;
};

export function StudentAppSettingsPanel({
  settings,
  onSettingsChange,
  onSaved,
}: Props) {
  const { t } = useI18n();

  const patch = (partial: Partial<PersonalSettings>) => {
    onSettingsChange(normalizePersonalSettings({ ...settings, ...partial }));
  };

  return (
    <section className={`${SOFT_CARD} p-5 space-y-4`}>
      <h2 className="font-semibold text-gray-900">
        <IconLabel icon={Settings} iconClassName="text-gray-600">
          {t("settings.appTitle", "App 設定")}
        </IconLabel>
      </h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        {t(
          "settings.appSubtitle",
          "語言、推播同提醒偏好。個人資料同飲食記錄請到「我的」分頁。"
        )}
      </p>

      <div className="flex items-center justify-between gap-3 py-1">
        <span className="text-sm font-medium text-gray-800">
          {t("settings.language", "介面語言")}
        </span>
        <LanguageSwitcher />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-zinc-500">
          {t("settings.waterReminder", "飲水提醒")}
        </label>
        <select
          value={settings.waterReminder}
          onChange={(e) =>
            patch({
              waterReminder: e.target.value as PersonalSettings["waterReminder"],
            })
          }
          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
        >
          {WATER_REMINDER_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(WATER_LABEL_KEY[key], key)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-zinc-500">
          {t("settings.morningReminderTime", "朝早提醒時間")}
        </label>
        <select
          value={settings.morningReminderTime}
          onChange={(e) =>
            patch({
              morningReminderTime: e.target
                .value as PersonalSettings["morningReminderTime"],
            })
          }
          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
        >
          {MORNING_REMINDER_TIME_OPTIONS.map((time) => (
            <option key={time} value={time}>
              {t("settings.morningTimeAt", "{time}", { time })}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          {t(
            "settings.morningReminderHint",
            "每日喺你揀嘅時間，鎖屏收到飲水同記錄飲食提醒（需開啟下方推播）。"
          )}
        </p>
      </div>

      <PushReminderToggle
        reminderSettings={settings}
        onSettingsSync={syncReminderSettingsToServer}
      />

      <button
        type="button"
        onClick={() => {
          localStorage.setItem("student_settings", JSON.stringify(settings));
          void syncReminderSettingsToServer(settings);
          onSaved(t("settings.saved", "設定已儲存"));
        }}
        className={`w-full ${BRAND_BTN} font-semibold py-3.5 rounded-2xl ${btnClass}`}
      >
        {t("settings.saveButton", "儲存設定")}
      </button>
    </section>
  );
}
