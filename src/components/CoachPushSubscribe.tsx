"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

/** 教練端：訂閱學員打卡 Web Push */
export function CoachPushSubscribe() {
  const { t } = useI18n();
  const {
    status,
    message,
    setMessage,
    supported,
    permission,
    refresh,
    enable,
    disable,
    testLocal,
  } = usePushSubscription();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEnable = async () => {
    const ok = await enable();
    if (ok) {
      setMessage(
        t(
          "coachPush.enabled",
          "✅ 已開啟推播！學員打卡時你會收到系統通知。"
        )
      );
    }
  };

  const handleTest = async () => {
    const ok = await testLocal();
    if (ok) {
      setMessage(
        t(
          "coachPush.testOk",
          "📲 已發送本機測試通知（關閉 App 後可由伺服器推播測試）。"
        )
      );
    }
  };

  if (!supported || status === "unsupported") {
    return (
      <div className="w-full rounded-3xl bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <p className="font-semibold">
          {t("coachPush.unsupportedTitle", "📲 學員打卡推播")}
        </p>
        <p className="mt-1">
          {t(
            "coachPush.unsupportedHint",
            "此瀏覽器不支援 Web Push。請用 Chrome / Safari，iPhone 需「加入主畫面」後從圖示開啟（iOS 16.4+）。"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-3xl bg-white p-4 space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div>
        <p className="font-semibold text-gray-900">
          {t("coachPush.title", "📲 學員打卡即時推播")}
        </p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          {t(
            "coachPush.description",
            "開啟後，學員上傳飲食紀錄時你會收到系統級通知，即使 App 在背景或已關閉。"
          )}
        </p>
        <p className="text-[10px] text-gray-400 mt-1">
          {t("coachPush.permission", "權限：{permission}", { permission })}
          {status === "enabled"
            ? t("coachPush.subscribed", " · 已訂閱")
            : ""}
        </p>
      </div>

      {status !== "enabled" ? (
        <button
          type="button"
          disabled={status === "loading" || permission === "denied"}
          onClick={handleEnable}
          className={`w-full py-3 rounded-2xl bg-[#7ED321] text-white text-sm font-bold disabled:opacity-50 ${btnClass}`}
        >
          {status === "loading"
            ? t("coachPush.processing", "處理中...")
            : t("coachPush.enable", "🔔 開啟推播通知")}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTest}
            className={`flex-1 py-2.5 rounded-2xl bg-gray-50 border border-gray-100 text-gray-800 text-xs font-semibold ${btnClass}`}
          >
            {t("coachPush.test", "測試通知")}
          </button>
          <button
            type="button"
            onClick={disable}
            className={`flex-1 py-2.5 rounded-2xl bg-gray-100 text-gray-600 text-xs font-semibold ${btnClass}`}
          >
            {t("coachPush.disable", "關閉")}
          </button>
        </div>
      )}

      {permission === "denied" && (
        <p className="text-xs text-red-600">
          {t(
            "coachPush.deniedHelp",
            "你先前拒絕了通知。請到系統設定 → 瀏覽器 → 通知 → 允許此網站。"
          )}
        </p>
      )}

      {message && (
        <p className="text-xs text-gray-700 bg-gray-50 rounded-xl px-3 py-2">
          {message}
        </p>
      )}
    </div>
  );
}
