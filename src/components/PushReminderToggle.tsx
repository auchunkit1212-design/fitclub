"use client";

import { useI18n } from "@/components/I18nProvider";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export function PushReminderToggle() {
  const { t } = useI18n();
  const {
    status,
    message,
    setMessage,
    supported,
    permission,
    enable,
    disable,
    testLocal,
  } = usePushSubscription();

  const handleEnable = async () => {
    const result = await enable();
    if (result.ok) {
      setMessage(
        t("push.messages.enabled", "✅ 已開啟系統通知，訂閱已儲存。")
      );
    } else {
      setMessage(`❌ ${result.error}`);
    }
  };

  const handleDisable = async () => {
    const ok = await disable();
    if (ok) {
      setMessage(t("push.messages.disabled", "已關閉推送訂閱。"));
    }
  };

  const handleTest = async () => {
    const ok = await testLocal();
    if (ok) {
      setMessage(
        t(
          "push.messages.testSent",
          "📲 已發送本機測試通知（若無彈出，請檢查系統通知設定）。"
        )
      );
    } else if (message) {
      setMessage(message);
    }
  };

  if (!supported || status === "unsupported") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold">{t("push.unsupported.title", "📲 系統通知")}</p>
        <p className="mt-1">
          {t(
            "push.unsupported.hint",
            "此裝置或瀏覽器唔支援 Web Push。iPhone 請用 Safari「加入主畫面」後，喺主畫面圖標開啟（iOS 16.4+）。"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
      <div>
        <p className="font-semibold text-sm text-emerald-900">
          {t("push.title", "📲 飲水與飲食提醒")}
        </p>
        <p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
          {t(
            "push.description",
            "開啟後即使閂咗 App，都可收到系統通知（需設定 VAPID 並執行 push_subscriptions.sql）。"
          )}
        </p>
        <p className="text-[10px] text-emerald-700/70 mt-1">
          {t("push.messages.permissionStatus", "權限狀態：{permission}{subscribed}", {
            permission,
            subscribed:
              status === "enabled"
                ? t("push.messages.subscribed", " · 已訂閱")
                : "",
          })}
        </p>
      </div>

      {status !== "enabled" ? (
        <button
          type="button"
          disabled={status === "loading" || permission === "denied"}
          onClick={handleEnable}
          className={`w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 ${btnClass}`}
        >
          {status === "loading"
            ? t("push.processing", "處理緊...")
            : t("push.enable", "🔔 開啟飲水與飲食提醒")}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTest}
            className={`flex-1 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold ${btnClass}`}
          >
            {t("push.test", "測試通知")}
          </button>
          <button
            type="button"
            onClick={handleDisable}
            className={`flex-1 py-2.5 rounded-xl bg-zinc-200 text-zinc-700 text-xs font-semibold ${btnClass}`}
          >
            {t("push.disable", "關閉")}
          </button>
        </div>
      )}

      {permission === "denied" && (
        <p className="text-xs text-red-600">
          {t(
            "push.denied.help",
            "你之前拒絕咗通知。請去 設定 → Safari/Chrome → 通知 → 允許 Nutrition Coach。"
          )}
        </p>
      )}

      {message && (
        <p className="text-xs text-emerald-900 bg-white/60 rounded-lg px-2 py-1.5">
          {message}
        </p>
      )}
    </div>
  );
}
