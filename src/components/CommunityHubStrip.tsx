"use client";

import { useI18n } from "@/components/I18nProvider";
import { COMMUNITY_HUB_ITEMS } from "@/lib/community-mock";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export function CommunityHubStrip() {
  const { t } = useI18n();

  return (
    <section className="min-w-0">
      <h2 className="text-sm font-semibold text-gray-900 mb-3 px-0.5">
        {t("community.hub.title", "新功能探索")}
      </h2>
      <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide overscroll-x-contain">
        <div className="flex gap-3 w-max max-w-none pb-1">
          {COMMUNITY_HUB_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => undefined}
                className={`shrink-0 w-[9.5rem] text-left rounded-3xl border bg-gradient-to-br p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${item.accent} ${btnClass}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="w-10 h-10 rounded-2xl bg-white/90 flex items-center justify-center shadow-sm">
                    <Icon
                      size={20}
                      strokeWidth={2}
                      className="text-emerald-700"
                      aria-hidden
                    />
                  </span>
                  {item.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm text-gray-900 leading-snug">
                  {t(`community.hub.${item.id}.title`, item.title)}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  {t(`community.hub.${item.id}.subtitle`, item.subtitle)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
