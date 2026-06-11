"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildStudentDailyCompliance,
  COMPLIANCE_CLASS,
  COMPLIANCE_LABEL,
  TARGET_SOURCE_LABEL,
  type ComplianceLevel,
  type MacroTargets,
  type StudentDailyComplianceRow,
  type TargetsSource,
} from "@/lib/nutrition-compliance";
import { getSessionRequestHeaders } from "@/lib/session";
import type {
  MealLog,
  RegistryUser,
  StudentBodyProfile,
  StudentNutritionTargets,
} from "@/lib/types";
import { CoachStudentMealsModal } from "@/components/CoachStudentMealsModal";
import { ChevronRight, IconLabel, Target, UtensilsCrossed } from "@/components/icons";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

function ComplianceBadge({ level }: { level: ComplianceLevel }) {
  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${COMPLIANCE_CLASS[level]}`}
    >
      {COMPLIANCE_LABEL[level]}
    </span>
  );
}

function SourceBadge({ source }: { source: TargetsSource }) {
  const className =
    source === "coach"
      ? "bg-emerald-100 text-emerald-800"
      : source === "ai"
        ? "bg-violet-100 text-violet-800"
        : "bg-zinc-100 text-zinc-600";
  return (
    <span
      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${className}`}
    >
      {TARGET_SOURCE_LABEL[source]}
    </span>
  );
}

function MacroCell({
  label,
  current,
  target,
  unit,
  level,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  level: ComplianceLevel;
}) {
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  return (
    <div className="rounded-lg bg-zinc-50 px-2.5 py-2 text-xs">
      <p className="text-[10px] font-semibold text-zinc-500 mb-0.5">{label}</p>
      <p className="font-medium text-zinc-800">
        {Math.round(current)}
        {unit}
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

function TargetSnapshotRow({
  title,
  badge,
  targets,
}: {
  title: string;
  badge: ReactNode;
  targets: MacroTargets;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-semibold text-zinc-600">{title}</p>
        {badge}
      </div>
      <p className="text-[11px] text-zinc-700 leading-relaxed">
        卡路里 {targets.calories} kcal · 蛋白質 {targets.protein}g · 碳水{" "}
        {targets.carbs}g · 脂肪 {targets.fats}g
      </p>
    </div>
  );
}

type Props = {
  logs: MealLog[];
  students: RegistryUser[];
  onLogUpdated?: (log: MealLog) => void;
  onLogDeleted?: (id: string) => void;
  onToast?: (message: string) => void;
};

export function CoachStudentDailyPanel({
  logs,
  students,
  onLogUpdated,
  onLogDeleted,
  onToast,
}: Props) {
  const [targetsMap, setTargetsMap] = useState<
    Record<string, StudentNutritionTargets | null>
  >({});
  const [bodyMap, setBodyMap] = useState<
    Record<string, StudentBodyProfile | null>
  >({});
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mealsStudent, setMealsStudent] = useState<RegistryUser | null>(null);

  useEffect(() => {
    if (students.length === 0) {
      setTargetsMap({});
      setBodyMap({});
      return;
    }
    let cancelled = false;
    setLoadingTargets(true);
    (async () => {
      const headers = getSessionRequestHeaders();
      const entries = await Promise.all(
        students.map(async (s) => {
          try {
            const [targetsRes, bodyRes] = await Promise.all([
              fetch(
                `/api/coach/student-targets?studentEmail=${encodeURIComponent(s.email)}`,
                { credentials: "include", headers }
              ),
              fetch(
                `/api/coach/student-body-profile?studentEmail=${encodeURIComponent(s.email)}`,
                { credentials: "include", headers }
              ),
            ]);
            const targetsData = targetsRes.ok
              ? ((await targetsRes.json()) as {
                  targets: StudentNutritionTargets | null;
                })
              : { targets: null };
            const bodyData = bodyRes.ok
              ? ((await bodyRes.json()) as {
                  profile: StudentBodyProfile | null;
                })
              : { profile: null };
            return [
              s.email,
              {
                targets: targetsData.targets ?? null,
                body: bodyData.profile ?? null,
              },
            ] as const;
          } catch {
            return [
              s.email,
              { targets: null, body: null },
            ] as const;
          }
        })
      );
      if (!cancelled) {
        setTargetsMap(
          Object.fromEntries(entries.map(([email, data]) => [email, data.targets]))
        );
        setBodyMap(
          Object.fromEntries(entries.map(([email, data]) => [email, data.body]))
        );
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
          bodyProfile: bodyMap[student.email] ?? null,
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
  }, [students, logs, targetsMap, bodyMap]);

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
        對照今日總攝取與生效目標。撳「飲食紀錄」可睇每位學員打卡詳情。
      </p>

      <div className="space-y-2">
        {rows.map((row) => {
          const isOpen = expanded === row.email;
          const snapshots = row.targetSnapshots;
          const showComparison =
            snapshots.coach &&
            snapshots.ai &&
            (snapshots.coach.calories !== snapshots.ai.calories ||
              snapshots.coach.protein !== snapshots.ai.protein ||
              snapshots.coach.carbs !== snapshots.ai.carbs ||
              snapshots.coach.fats !== snapshots.ai.fats);

          const subtitleParts: string[] = [`${row.mealCount} 餐`];
          if (snapshots.coach) {
            subtitleParts.push(
              snapshots.coachLocked ? "教練聖旨（已鎖定）" : "教練草稿"
            );
          }
          if (snapshots.ai) {
            subtitleParts.push(
              snapshots.aiFromBody ? "AI 建議（身體檔案）" : "AI 建議（已鎖定）"
            );
          }
          if (!snapshots.coach && !snapshots.ai) {
            subtitleParts.push(TARGET_SOURCE_LABEL.default);
          }
          subtitleParts.push(`對照：${TARGET_SOURCE_LABEL[row.targetsSource]}`);

          const student = students.find((s) => s.email === row.email);

          return (
            <div
              key={row.email}
              className="rounded-xl border border-zinc-100 overflow-hidden"
            >
              <div className="flex items-stretch bg-zinc-50/80">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.email)}
                  className={`flex-1 min-w-0 text-left px-3 py-2.5 hover:bg-zinc-50 transition-colors ${btnClass}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-zinc-900 truncate">
                        {row.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {subtitleParts.join(" · ")}
                      </p>
                    </div>
                    <ComplianceBadge level={row.macroLevels.overall} />
                  </div>
                </button>
                {student && (
                  <button
                    type="button"
                    onClick={() => setMealsStudent(student)}
                    className={`shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 border-l border-zinc-100 text-emerald-700 hover:bg-emerald-50 transition-colors ${btnClass}`}
                    aria-label={`查看 ${row.name} 飲食紀錄`}
                  >
                    <UtensilsCrossed size={16} strokeWidth={2} aria-hidden />
                    <span className="text-[10px] font-semibold whitespace-nowrap">
                      飲食紀錄
                    </span>
                    <span className="text-[9px] text-emerald-600/80">
                      {row.mealCount} 餐
                    </span>
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="px-3 py-3 space-y-3 border-t border-zinc-100 bg-white">
                  {student && (
                    <button
                      type="button"
                      onClick={() => setMealsStudent(student)}
                      className={`w-full flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-left text-emerald-800 ${btnClass}`}
                    >
                      <span className="text-xs font-semibold">
                        <IconLabel
                          icon={UtensilsCrossed}
                          size="sm"
                          iconClassName="text-emerald-700"
                        >
                          查看今日飲食紀錄（{row.mealCount} 餐）
                        </IconLabel>
                      </span>
                      <ChevronRight size={16} strokeWidth={2} aria-hidden />
                    </button>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-zinc-600">
                      今日攝取 vs 生效目標
                    </p>
                    <SourceBadge source={row.targetsSource} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <MacroCell
                      label="卡路里"
                      current={row.totals.calories}
                      target={row.targets.calories}
                      unit=" kcal"
                      level={row.macroLevels.calories}
                    />
                    <MacroCell
                      label="蛋白質"
                      current={row.totals.protein}
                      target={row.targets.protein}
                      unit="g"
                      level={row.macroLevels.protein}
                    />
                    <MacroCell
                      label="碳水"
                      current={row.totals.carbs}
                      target={row.targets.carbs}
                      unit="g"
                      level={row.macroLevels.carbs}
                    />
                    <MacroCell
                      label="脂肪"
                      current={row.totals.fats}
                      target={row.targets.fats}
                      unit="g"
                      level={row.macroLevels.fats}
                    />
                  </div>

                  {showComparison && (
                    <div className="space-y-2 border-t border-zinc-100 pt-2">
                      <p className="text-[10px] font-semibold text-zinc-600">
                        目標對照
                      </p>
                      {snapshots.coach && (
                        <TargetSnapshotRow
                          title="教練建議"
                          badge={
                            snapshots.coachLocked ? (
                              <span className="text-[10px] text-emerald-700 font-medium">
                                已鎖定
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500">
                                草稿
                              </span>
                            )
                          }
                          targets={snapshots.coach}
                        />
                      )}
                      {snapshots.ai && (
                        <TargetSnapshotRow
                          title="AI 建議"
                          badge={
                            <span className="text-[10px] text-violet-700 font-medium">
                              {snapshots.aiFromBody
                                ? "身體檔案估算"
                                : "AI 聖旨"}
                            </span>
                          }
                          targets={snapshots.ai}
                        />
                      )}
                    </div>
                  )}

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

      {mealsStudent && (
        <CoachStudentMealsModal
          student={mealsStudent}
          logs={logs}
          onClose={() => setMealsStudent(null)}
          onLogUpdated={onLogUpdated}
          onLogDeleted={onLogDeleted}
          onToast={onToast}
        />
      )}
    </section>
  );
}
