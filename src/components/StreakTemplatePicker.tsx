"use client";

import { useI18n } from "@/components/I18nProvider";
import {
  STREAK_CARD_TEMPLATE_IDS,
  getStreakTemplateMeta,
  type StreakCardTemplateId,
} from "@/lib/streak-templates";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  value: StreakCardTemplateId;
  onChange: (id: StreakCardTemplateId) => void;
  compact?: boolean;
  dark?: boolean;
};

export function StreakTemplatePicker({
  value,
  onChange,
  compact = false,
  dark = false,
}: Props) {
  const { t } = useI18n();
  const titleClass = dark ? "text-slate-200" : "text-zinc-700";
  const subtitleClass = dark ? "text-slate-400" : "text-zinc-500";
  const pickClass = dark ? "text-slate-300" : "text-zinc-600";

  return (
    <div className="space-y-2">
      {!compact ? (
        <div className="text-left">
          <p className={`text-xs font-semibold ${titleClass}`}>
            {t("streak.template.title", "打卡慶祝樣式")}
          </p>
          <p className={`text-[11px] mt-0.5 leading-relaxed ${subtitleClass}`}>
            {t(
              "streak.template.subtitle",
              "揀一款分享圖同慶祝彈窗風格，儲存後下次自動套用"
            )}
          </p>
        </div>
      ) : (
        <p className={`text-[11px] font-semibold text-left ${pickClass}`}>
          {t("streak.template.pick", "揀分享圖樣式")}
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {STREAK_CARD_TEMPLATE_IDS.map((id) => {
          const meta = getStreakTemplateMeta(id);
          const active = value === id;
          const { preview } = meta;
          const gradient = preview.via
            ? `linear-gradient(135deg, ${preview.from}, ${preview.via}, ${preview.to})`
            : `linear-gradient(135deg, ${preview.from}, ${preview.to})`;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`shrink-0 w-[5.5rem] rounded-2xl p-1.5 text-left ${btnClass} ${
                active
                  ? "ring-2 ring-emerald-500 ring-offset-2 bg-white"
                  : "ring-1 ring-zinc-200 bg-zinc-50"
              }`}
              aria-pressed={active}
            >
              <div
                className="h-14 rounded-xl flex flex-col items-center justify-center shadow-inner"
                style={{ background: gradient }}
              >
                <span
                  className="text-lg font-black tabular-nums"
                  style={{ color: preview.text }}
                >
                  7
                </span>
                <span
                  className="text-[8px] font-semibold opacity-90"
                  style={{ color: preview.accent }}
                >
                  DAY
                </span>
              </div>
              <p className="text-[10px] font-semibold text-zinc-800 mt-1.5 px-0.5 truncate">
                {meta.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
