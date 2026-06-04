"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildStudentDailyCompliance,
  COMPLIANCE_CLASS,
  COMPLIANCE_LABEL,
  type ComplianceLevel,
  type StudentDailyComplianceRow,
} from "@/lib/nutrition-compliance";
import { getSessionRequestHeaders } from "@/lib/session";
import type { MealLog, RegistryUser, StudentNutritionTargets } from "@/lib/types";
import { IconLabel, Target } from "@/components/icons";

function ComplianceBadge({ level }: { level: ComplianceLevel }) {
  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${COMPLIANCE_CLASS[level]}`}
    >
      {COMPLIANCE_LABEL[level]}
    </span>
  );
}

function MacroCell({
  current,
  target,
  unit,
  level,
}: {
  current: number;
  target: number;
  unit: string;
  level: ComplianceLevel;
}) {
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  return (
    <div className="text-xs">
      <p className="font-medium text-zinc-800">
        {Math.round(current)}
        {unit ? unit : ""}
        <span className="text-zinc-400 font-normal">
          {" "}
          / {Math.round(target)}
          {unit}
        </span>
      </p>
      <p className="text-[10px] text-zinc-500">{pct}%</p>
      <ComplianceBadge level={level} />
    </div>
  );
}

type Props = {
  logs: MealLog[];
  students: RegistryUser[];
};

export function CoachStudentDailyPanel({ logs, students }: Props) {
  const [targetsMap, setTargetsMap] = useState<
    Record<string, StudentNutritionTargets | null>
  >({});
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (students.length === 0) {
      setTargetsMap({});
      return;
    }
    let cancelled = false;
    setLoadingTargets(true);
    (async () => {
      const headers = getSessionRequestHeaders();
      const entries = await Promise.all(
        students.map(async (s) => {
          try {
            const res = await fetch(
              `/api/coach/student-targets?studentEmail=${encodeURIComponent(s.email)}`,
              { credentials: "include", headers }
            );
            if (!res.ok) return [s.email, null] as const;
            const data = (await res.json()) as {
              targets: StudentNutritionTargets | null;
            };
            return [s.email, data.targets ?? null] as const;
          } catch {
            return [s.email, null] as const;
          }
        })
      );
      if (!cancelled) {
        setTargetsMap(Object.fromEntries(entries));
        setLoadingTargets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [students]);

  const rows: StudentDailyComplianceRow[] = useMemo(() => {
    return students
      .map((student) =>
        buildStudentDailyCompliance({
          student,
          logs,
          coachTargets: targetsMap[student.email] ?? null,
        })
      )
      .sort((a, b) => {
        const order: Record<ComplianceLevel, number> = {
          low: 0,
          partial: 1,
          over: 2,
          none: 3,
          met: 4,
        };
        return order[a.macroLevels.overall] - order[b.macroLevels.overall];
      });
  }, [students, logs, targetsMap]);

  if (students.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-start gap-2">
        <h2 className="font-semibold text-zinc-800 text-sm">
          <IconLabel icon={Target} iconClassName="text-emerald-600">
            學員今日攝取達標
          </IconLabel>
        </h2>
        {loadingTargets && (
          <span className="text-[10px] text-zinc-400">載入目標中…</span>
        )}
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">
        對照每位學員今日總攝取與教練設定目標（未設定則用預設值）。優先顯示未達標學員。
      </p>

      <div className="space-y-2">
        {rows.map((row) => {
          const isOpen = expanded === row.email;
          return (
            <div
              key={row.email}
              className="rounded-xl border border-zinc-100 overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded(isOpen ? null : row.email)
                }
                className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 bg-zinc-50/80 hover:bg-zinc-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-zinc-900 truncate">
                    {row.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {row.mealCount} 餐 ·{" "}
                    {row.targetsSource === "coach" ? "教練目標" : "預設目標"}
                  </p>
                </div>
                <ComplianceBadge level={row.macroLevels.overall} />
              </button>

              {isOpen && (
                <div className="px-3 py-3 space-y-3 border-t border-zinc-100 bg-white">
                  <div className="grid grid-cols-2 gap-3">
                    <MacroCell
                      current={row.totals.calories}
                      target={row.targets.calories}
                      unit=""
                      level={row.macroLevels.calories}
                    />
                    <MacroCell
                      current={row.totals.protein}
                      target={row.targets.protein}
                      unit="g"
                      level={row.macroLevels.protein}
                    />
                    <MacroCell
                      current={row.totals.carbs}
                      target={row.targets.carbs}
                      unit="g"
                      level={row.macroLevels.carbs}
                    />
                    <MacroCell
                      current={row.totals.fats}
                      target={row.targets.fats}
                      unit="g"
                      level={row.macroLevels.fats}
                    />
                  </div>

                  <div className="border-t border-zinc-100 pt-2">
                    <p className="text-[10px] font-semibold text-zinc-600 mb-2">
                      進階營養素（估算）
                    </p>
                    <ul className="space-y-1.5 text-xs text-zinc-700">
                      <li className="flex justify-between gap-2">
                        <span>膳食纖維</span>
                        <span>
                          {row.micro.fiberG}g / ≥{row.microTargets.fiberGMin}g{" "}
                          <ComplianceBadge level={row.microLevels.fiber} />
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span>糖分</span>
                        <span>
                          {row.micro.sugarG}g / ≤{row.microTargets.sugarGMax}g{" "}
                          <ComplianceBadge level={row.microLevels.sugar} />
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span>鈉</span>
                        <span>
                          {row.micro.sodiumMg}mg / ≤
                          {row.microTargets.sodiumMgMax}mg{" "}
                          <ComplianceBadge level={row.microLevels.sodium} />
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
