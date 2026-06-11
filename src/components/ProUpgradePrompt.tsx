"use client";

import { useI18n } from "@/components/I18nProvider";
import { Sparkles } from "@/components/icons";
import { ProCheckoutButton } from "@/components/ProCheckoutButton";
import { getSession } from "@/lib/session";

type Props = {
  feature?: string;
  className?: string;
};

export function ProUpgradePrompt({ feature, className = "" }: Props) {
  const { t } = useI18n();
  const session = getSession();
  const tier = session?.role === "coach" ? "coach_pro" : "solo";
  const label =
    feature ??
    t("profile.proFeatureDefault", "此進階功能");

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-4 space-y-2 ${className}`}
    >
      <p className="text-sm font-semibold text-amber-950 flex items-center gap-2">
        <Sparkles size={16} className="text-amber-600 shrink-0" aria-hidden />
        {t("profile.proOnlyTitle", "Pro 會員功能")}
      </p>
      <p className="text-xs text-amber-900 leading-relaxed">
        {t(
          "profile.proOnlyBody",
          "{feature}僅供 Pro 使用。學員可升級個人 Pro，或由 Pro 教練帶隊自動享有。",
          { feature: label }
        )}
      </p>
      <p className="text-[11px] text-amber-800/80">
        {t(
          "profile.proCoachHint",
          "教練升 Pro：無限學員 + 旗下學員享有微營養分析同 AI 推薦菜單。"
        )}
      </p>
      <ProCheckoutButton tier={tier} />
    </div>
  );
}
