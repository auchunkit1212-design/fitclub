"use client";

import { useI18n } from "@/components/I18nProvider";
import { Cpu, GraduationCap, Sparkles, IconLabel } from "@/components/icons";
import { useSyncedSession } from "@/hooks/use-synced-session";
import { hasProAccessFromSession } from "@/lib/plan-access";
import { FreeTrialBadge } from "@/components/FreeTrialBadge";
import {
  ProCheckoutButton,
  ProManageBillingButton,
} from "@/components/ProCheckoutButton";

export function ProBillingPanel() {
  const { t } = useI18n();
  const session = useSyncedSession();
  const isPro = hasProAccessFromSession(session);

  if (!session?.email || session.role === "admin") return null;

  const isCoach = session.role === "coach";

  return (
    <section className="rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">
        <IconLabel icon={Sparkles} iconClassName="text-amber-600">
          {t("billing.sectionTitle", "訂閱方案")}
        </IconLabel>
      </h2>

      {isPro ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700 font-medium">
            {session.isProTrial
              ? t("billing.currentProTrial", "你正在 Pro 免費試用期")
              : t("billing.currentPro", "你已是 Pro 會員")}
          </p>
          {session.isProTrial ? <FreeTrialBadge /> : null}
          <ProManageBillingButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {isCoach ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
              <p className="font-semibold text-indigo-950 flex items-center gap-2 text-sm">
                <GraduationCap size={16} className="shrink-0" aria-hidden />
                {t("billing.coachProPlanTitle", "Pro 專業教練版")}
              </p>
              <p className="text-xs text-indigo-900/80 leading-relaxed">
                {t(
                  "billing.coachProPlanDesc",
                  "HK$399/月 · 無限學員、白標品牌、AI 週報、旗下學員享有 Pro 功能。"
                )}
              </p>
              <ProCheckoutButton tier="coach_pro" />
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
              <p className="font-semibold text-emerald-950 flex items-center gap-2 text-sm">
                <Cpu size={16} className="shrink-0" aria-hidden />
                {t("billing.soloPlanTitle", "Solo AI 散客版")}
              </p>
              <p className="text-xs text-emerald-900/80 leading-relaxed">
                {t(
                  "billing.soloPlanDesc",
                  "HK$68/月 · 大猩猩 AI 私教、微營養分析、AI 配餐推薦。"
                )}
              </p>
              <ProCheckoutButton tier="solo" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
