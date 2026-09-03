"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  Bell,
  Brain,
  ChevronLeft,
  ChevronRight,
  CircleUser,
  Globe,
  Home,
  Rocket,
  ScanLine,
  Ticket,
  UtensilsCrossed,
} from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { markAppGuideComplete } from "@/lib/app-guide";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const STEPS: { id: string; icon: LucideIcon }[] = [
  { id: "welcome", icon: Rocket },
  { id: "nav", icon: Home },
  { id: "recordMeal", icon: UtensilsCrossed },
  { id: "scanLabel", icon: ScanLine },
  { id: "aiVerify", icon: Brain },
  { id: "home", icon: BarChart2 },
  { id: "community", icon: Globe },
  { id: "profile", icon: CircleUser },
  { id: "settings", icon: Bell },
  { id: "coachInvite", icon: Ticket },
];

interface StudentAppGuideProps {
  open: boolean;
  onClose: () => void;
  themeBtn?: string;
}

export function StudentAppGuide({
  open,
  onClose,
  themeBtn = "bg-emerald-600",
}: StudentAppGuideProps) {
  const { t } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  if (!open) return null;

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const StepIcon = step.icon;

  const finish = () => {
    markAppGuideComplete();
    setStepIndex(0);
    onClose();
  };

  const handleSkip = () => finish();

  const handleNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleBack = () => {
    if (!isFirst) setStepIndex((i) => i - 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white px-5 py-5 rounded-t-3xl shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-emerald-100 text-sm font-medium">
                {t("appGuide.badge", "新手教學 · 功能導覽")}
              </p>
              <h2 className="text-xl font-bold mt-1 truncate">
                {t("appGuide.title", "App 使用指引")}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              className={`shrink-0 text-sm text-white/90 underline underline-offset-2 ${btnClass}`}
            >
              {t("appGuide.skip", "跳過")}
            </button>
          </div>
          <p className="text-xs text-white/80 mt-2">
            {t("appGuide.progress", "第 {current} / {total} 步", {
              current: stepIndex + 1,
              total: STEPS.length,
            })}
          </p>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <StepIcon size={40} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="space-y-3 w-full">
              <h3 className="text-lg font-bold text-gray-900">
                {t(`appGuide.steps.${step.id}.title`, step.id)}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line text-left">
                {t(`appGuide.steps.${step.id}.body`, "")}
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-1.5 mt-6">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex
                    ? "w-5 bg-emerald-600"
                    : i < stepIndex
                      ? "w-1.5 bg-emerald-300"
                      : "w-1.5 bg-gray-200"
                }`}
                aria-hidden
              />
            ))}
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-2 shrink-0">
          {!isFirst && (
            <button
              type="button"
              onClick={handleBack}
              className={`flex-1 py-3.5 rounded-2xl border border-zinc-200 text-gray-700 font-semibold inline-flex items-center justify-center gap-1 ${btnClass}`}
            >
              <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
              {t("appGuide.back", "上一步")}
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            className={`${isFirst ? "w-full" : "flex-[2]"} ${themeBtn} text-white font-bold py-3.5 rounded-2xl inline-flex items-center justify-center gap-1 ${btnClass}`}
          >
            {isLast ? (
              t("appGuide.finish", "開始使用")
            ) : (
              <>
                {t("appGuide.next", "下一步")}
                <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
