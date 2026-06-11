"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { StudentAppGuide } from "@/components/StudentAppGuide";
import { StudentAppSettingsPanel } from "@/components/StudentAppSettingsPanel";
import { ProBillingPanel } from "@/components/ProBillingPanel";
import { ShareAppButton } from "@/components/ShareAppButton";
import { Settings, IconLabel } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { resetAppGuide } from "@/lib/app-guide";
import {
  DEFAULT_PERSONAL_SETTINGS,
  normalizePersonalSettings,
  type PersonalSettings,
} from "@/lib/personal-settings";
import { loadReminderSettingsFromServer } from "@/lib/reminder-settings-client";
import { getSession } from "@/lib/session";

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [settings, setSettings] = useState<PersonalSettings>(
    DEFAULT_PERSONAL_SETTINGS
  );
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [showAppGuide, setShowAppGuide] = useState(false);

  useEffect(() => {
    const parsed = getSession();
    if (!parsed || parsed.role !== "student") {
      router.replace(parsed ? "/" : "/register");
      return;
    }

    const raw = localStorage.getItem("student_settings");
    if (raw) {
      try {
        setSettings(normalizePersonalSettings(JSON.parse(raw)));
      } catch {
        // ignore
      }
    }

    void (async () => {
      const cloud = await loadReminderSettingsFromServer();
      if (cloud) {
        setSettings((prev) => normalizePersonalSettings({ ...prev, ...cloud }));
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
        {t("common.loading", "載入中…")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 overflow-x-hidden max-w-lg mx-auto w-full">
      <header className="pt-safe px-4 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">
          <IconLabel icon={Settings} iconClassName="text-gray-600" gapClass="gap-2">
            {t("nav.settings", "設定")}
          </IconLabel>
        </h1>
      </header>

      <main className="px-4 py-5 min-w-0 space-y-4">
        <ProBillingPanel />
        <ShareAppButton
          onToast={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(""), 3000);
          }}
        />
        <StudentAppSettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onSaved={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(""), 3000);
          }}
          onOpenAppGuide={() => {
            resetAppGuide();
            setShowAppGuide(true);
          }}
        />
      </main>

      {showAppGuide && (
        <StudentAppGuide
          open={showAppGuide}
          onClose={() => setShowAppGuide(false)}
        />
      )}

      <BottomNav role="student" onFabClick={() => router.push("/add-meal")} />

      {toast && (
        <div className="fixed bottom-28 left-4 right-4 max-w-lg mx-auto bg-gray-900 text-white text-sm text-center py-3 rounded-xl z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
