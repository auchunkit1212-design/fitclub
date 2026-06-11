"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { markHasUsedMealPlan } from "@/lib/onboarding-flags";
import type { UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  session: UserSession;
  onDismiss?: () => void;
};

export function ProTrialMealPlanBanner({ session, onDismiss }: Props) {
  const router = useRouter();
  const { t } = useI18n();

  const goSettings = () => {
    markHasUsedMealPlan(session.email);
    onDismiss?.();
    router.push("/settings");
  };

  return (
    <div className="w-full rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 shadow-sm">
      <p className="text-sm font-semibold text-amber-950 leading-relaxed">
        {t(
          "onboarding.proTrialMealPlan",
          "🔥 你的 Pro 試用期正在進行中！立即解鎖專屬 AI 餐單功能，教練會根據你的目標為你度身訂造飲食！"
        )}
      </p>
      <button
        type="button"
        onClick={goSettings}
        className={`mt-3 w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2.5 ${btnClass}`}
      >
        {t("onboarding.goSettings", "👉 前往設定")}
      </button>
    </div>
  );
}
