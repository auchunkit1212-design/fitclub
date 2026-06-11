"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "@/components/icons";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export type CoachStudentsSection = "review" | "daily" | "roster" | "history";

const SECTION_LABELS: Record<CoachStudentsSection, string> = {
  review: "待批閱飲食",
  daily: "今日攝取達標",
  roster: "學員名單",
  history: "飲食歷史",
};

type SectionItem = {
  id: CoachStudentsSection;
  label: string;
  showCoachOnly?: boolean;
};

const SECTIONS: SectionItem[] = [
  { id: "review", label: SECTION_LABELS.review, showCoachOnly: true },
  { id: "daily", label: SECTION_LABELS.daily },
  { id: "roster", label: SECTION_LABELS.roster },
  { id: "history", label: SECTION_LABELS.history },
];

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold leading-none inline-flex items-center justify-center">
      {label}
    </span>
  );
}

function UnreadDot() {
  return (
    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
  );
}

interface CoachStudentsSectionPickerProps {
  activeSection: CoachStudentsSection;
  onSectionChange: (section: CoachStudentsSection) => void;
  unreviewedCount: number;
  isCoach: boolean;
  onBack: () => void;
}

export function CoachStudentsSectionPicker({
  activeSection,
  onSectionChange,
  unreviewedCount,
  isCoach,
  onBack,
}: CoachStudentsSectionPickerProps) {
  const [open, setOpen] = useState(false);

  const visibleSections = SECTIONS.filter(
    (s) => !s.showCoachOnly || isCoach
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pick = (section: CoachStudentsSection) => {
    onSectionChange(section);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative shrink-0 flex items-center gap-1 text-sm font-semibold px-3 py-2.5 rounded-lg min-h-[44px] max-w-[9.5rem] ${btnClass} text-gray-700 bg-gray-100`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate">{SECTION_LABELS[activeSection]}</span>
        <ChevronRight
          size={16}
          strokeWidth={2.25}
          className="shrink-0 rotate-90 text-gray-500"
          aria-hidden
        />
        {unreviewedCount > 0 && isCoach && <UnreadDot />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end">
          <button
            type="button"
            aria-label="關閉"
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="選擇學員頁面區塊"
            className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl shadow-[0_-12px_40px_rgb(0,0,0,0.12)] px-4 pt-3 pb-8 pb-[max(2rem,env(safe-area-inset-bottom))]"
          >
            <div className="w-10 h-1 rounded-full bg-zinc-200 mx-auto mb-4" />
            <h2 className="text-base font-bold text-zinc-900 mb-3 px-1">
              選擇區塊
            </h2>
            <ul className="space-y-1">
              {visibleSections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => pick(section.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-semibold ${btnClass} ${
                      activeSection === section.id
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-zinc-50 text-zinc-800 border border-transparent hover:bg-zinc-100"
                    }`}
                  >
                    <span>{section.label}</span>
                    {section.id === "review" && isCoach ? (
                      <UnreadBadge count={unreviewedCount} />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onBack();
              }}
              className={`w-full mt-4 py-3.5 rounded-xl bg-zinc-100 text-zinc-700 text-sm font-semibold ${btnClass}`}
            >
              ← 返回主頁
            </button>
          </div>
        </div>
      )}
    </>
  );
}
