"use client";

import { useMemo, useRef, useState } from "react";
import { BodyCompositionTrendChart } from "@/components/BodyCompositionTrendChart";
import { useI18n } from "@/components/I18nProvider";
import { Camera, IconLabel, Loader2, Scale } from "@/components/icons";
import {
  fetchBodyCompositionLogsLastDays,
  upsertBodyCompositionLog,
} from "@/lib/body-composition-logs";
import { compressFileImage } from "@/lib/image";
import type { InBodyScanResult } from "@/lib/inbody-scan";
import { getSessionRequestHeaders } from "@/lib/session";
import type { BodyCompositionLog } from "@/lib/types";
import { upsertWeightLog } from "@/lib/weight-logs";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const BRAND_BTN = "bg-emerald-600 hover:bg-emerald-700 text-white";

type DraftFields = {
  weightKg: string;
  bodyFatPct: string;
  muscleMassKg: string;
  skeletalMuscleKg: string;
  visceralFatLevel: string;
  bmrKcal: string;
  bodyWaterPct: string;
  logDate: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nullableToInput(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "" : String(value);
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function resultToDraft(result: InBodyScanResult): DraftFields {
  return {
    weightKg: nullableToInput(result.weightKg),
    bodyFatPct: nullableToInput(result.bodyFatPct),
    muscleMassKg: nullableToInput(result.muscleMassKg),
    skeletalMuscleKg: nullableToInput(result.skeletalMuscleKg),
    visceralFatLevel: nullableToInput(result.visceralFatLevel),
    bmrKcal: nullableToInput(result.bmrKcal),
    bodyWaterPct: nullableToInput(result.bodyWaterPct),
    logDate: result.logDate || todayIsoDate(),
  };
}

function deltaText(
  current: number | null,
  previous: number | null,
  unit: string
): string | null {
  if (current == null || previous == null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return `±0${unit}`;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff}${unit}`;
}

type Props = {
  email: string;
  logs: BodyCompositionLog[];
  loading: boolean;
  onLogsChange: (logs: BodyCompositionLog[]) => void;
  onToast: (message: string) => void;
  onWeightSynced?: (weightKg: number) => void;
};

export function InBodyScanPanel({
  email,
  logs,
  loading,
  onLogsChange,
  onToast,
  onWeightSynced,
}: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<DraftFields | null>(null);
  const [deviceHint, setDeviceHint] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const latest = logs.length > 0 ? logs[logs.length - 1] : null;
  const previous = logs.length > 1 ? logs[logs.length - 2] : null;

  const summaryCards = useMemo(() => {
    if (!latest) return [];
    return [
      {
        key: "bodyFat",
        label: t("inbody.metric.bodyFat", "體脂率"),
        value:
          latest.bodyFatPct != null ? `${latest.bodyFatPct}%` : "—",
        delta: deltaText(latest.bodyFatPct, previous?.bodyFatPct ?? null, "%"),
      },
      {
        key: "muscle",
        label: t("inbody.metric.muscle", "肌肉量"),
        value:
          latest.muscleMassKg != null
            ? `${latest.muscleMassKg} kg`
            : latest.skeletalMuscleKg != null
              ? `${latest.skeletalMuscleKg} kg`
              : "—",
        delta: deltaText(
          latest.muscleMassKg ?? latest.skeletalMuscleKg,
          previous?.muscleMassKg ?? previous?.skeletalMuscleKg ?? null,
          " kg"
        ),
      },
      {
        key: "visceral",
        label: t("inbody.metric.visceral", "內臟脂肪"),
        value:
          latest.visceralFatLevel != null
            ? String(latest.visceralFatLevel)
            : "—",
        delta: deltaText(
          latest.visceralFatLevel,
          previous?.visceralFatLevel ?? null,
          ""
        ),
      },
      {
        key: "weight",
        label: t("inbody.metric.weight", "體重"),
        value: latest.weightKg != null ? `${latest.weightKg} kg` : "—",
        delta: deltaText(latest.weightKg, previous?.weightKg ?? null, " kg"),
      },
    ];
  }, [latest, previous, t]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setScanning(true);
    setDraft(null);
    setDeviceHint("");

    try {
      const dataUrl = await compressFileImage(file);
      setPreviewUrl(dataUrl);

      const res = await fetch("/api/ai/inbody-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = (await res.json()) as InBodyScanResult & { error?: string };
      if (!res.ok) {
        throw new Error(
          data.error ||
            t(
              "inbody.scanFailed",
              "辨識失敗，請影清楚成張報告再試"
            )
        );
      }

      setDraft(resultToDraft(data));
      setDeviceHint(data.deviceHint || "");
      onToast(t("inbody.scanOk", "已讀取報告，請核對數字後儲存"));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("inbody.scanFailed", "辨識失敗，請影清楚成張報告再試");
      setError(message);
      setPreviewUrl(null);
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError("");

    try {
      const weightKg = parseOptionalNumber(draft.weightKg);
      const bodyFatPct = parseOptionalNumber(draft.bodyFatPct);
      const muscleMassKg = parseOptionalNumber(draft.muscleMassKg);
      const skeletalMuscleKg = parseOptionalNumber(draft.skeletalMuscleKg);
      const visceralFatLevel = parseOptionalNumber(draft.visceralFatLevel);
      const bmrKcal = parseOptionalNumber(draft.bmrKcal);
      const bodyWaterPct = parseOptionalNumber(draft.bodyWaterPct);
      const logDate = draft.logDate.trim() || todayIsoDate();

      if (
        weightKg == null &&
        bodyFatPct == null &&
        muscleMassKg == null &&
        skeletalMuscleKg == null
      ) {
        throw new Error(
          t("inbody.needMetrics", "請至少填寫體重、體脂或肌肉量其中一項")
        );
      }

      await upsertBodyCompositionLog(email, {
        weightKg,
        bodyFatPct,
        muscleMassKg,
        skeletalMuscleKg,
        visceralFatLevel,
        bmrKcal,
        bodyWaterPct,
        imageUrl: null,
        source: "inbody_ocr",
        rawAiJson: {
          deviceHint,
          previewSaved: Boolean(previewUrl),
        },
        logDate,
      });

      if (weightKg != null && weightKg >= 30 && weightKg <= 300) {
        await upsertWeightLog(email, weightKg, logDate);
        onWeightSynced?.(weightKg);
      }

      const refreshed = await fetchBodyCompositionLogsLastDays(email, 90);
      onLogsChange(refreshed);
      setDraft(null);
      setPreviewUrl(null);
      setDeviceHint("");
      onToast(t("inbody.saved", "InBody 進度已記錄"));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("inbody.saveFailed", "儲存失敗，請稍後再試");
      setError(message);
      onToast(message);
    } finally {
      setSaving(false);
    }
  };

  const patchDraft = (key: keyof DraftFields, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <section className="w-full rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-5 space-y-4 overflow-hidden min-w-0">
      <div className="flex justify-between items-start gap-2 min-w-0">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900">
            <IconLabel icon={Scale} iconClassName="text-emerald-600">
              {t("inbody.title", "InBody 身體組成")}
            </IconLabel>
          </h2>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            {t(
              "inbody.subtitle",
              "影張 InBody／體脂報告，AI 自動讀取體脂、肌肉同內臟脂肪，追蹤真正進度。"
            )}
          </p>
        </div>
        <span className="text-xs text-gray-500 shrink-0">
          {t("inbody.last90Days", "過去 90 日")}
        </span>
      </div>

      {summaryCards.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {summaryCards.map((card) => (
            <div
              key={card.key}
              className="rounded-2xl bg-zinc-50 border border-zinc-100 px-3 py-2.5"
            >
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                {card.label}
              </p>
              <p className="text-lg font-bold text-zinc-900 mt-0.5">{card.value}</p>
              {card.delta && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {t("inbody.vsPrev", "較上次")} {card.delta}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <BodyCompositionTrendChart logs={logs} loading={loading} />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />

      <button
        type="button"
        disabled={scanning}
        onClick={() => inputRef.current?.click()}
        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl ${BRAND_BTN} text-sm font-semibold disabled:opacity-60 ${btnClass}`}
      >
        {scanning ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden />
            {t("inbody.scanning", "大猩猩讀緊報告...")}
          </>
        ) : (
          <>
            <Camera size={18} aria-hidden />
            {t("inbody.scanButton", "影相上傳 InBody")}
          </>
        )}
      </button>

      {error && (
        <p className="text-sm text-red-600 leading-relaxed">{error}</p>
      )}

      {draft && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                {t("inbody.reviewTitle", "核對讀取結果")}
              </p>
              <p className="text-xs text-emerald-800/80 mt-0.5">
                {deviceHint
                  ? t("inbody.deviceHint", "儀器：{device}", { device: deviceHint })
                  : t("inbody.reviewHint", "數字唔啱可以改，確認後先儲存。")}
              </p>
            </div>
            {previewUrl && (
              <img
                src={previewUrl}
                alt=""
                className="w-14 h-14 rounded-xl object-cover border border-emerald-100"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["logDate", t("inbody.field.date", "日期"), "date"],
                ["weightKg", t("inbody.field.weight", "體重 (kg)"), "decimal"],
                ["bodyFatPct", t("inbody.field.bodyFat", "體脂率 (%)"), "decimal"],
                ["muscleMassKg", t("inbody.field.muscle", "肌肉量 (kg)"), "decimal"],
                [
                  "skeletalMuscleKg",
                  t("inbody.field.smm", "骨骼肌 (kg)"),
                  "decimal",
                ],
                [
                  "visceralFatLevel",
                  t("inbody.field.visceral", "內臟脂肪"),
                  "decimal",
                ],
                ["bmrKcal", t("inbody.field.bmr", "BMR (kcal)"), "decimal"],
                [
                  "bodyWaterPct",
                  t("inbody.field.water", "體水分 (%)"),
                  "decimal",
                ],
              ] as const
            ).map(([key, label, mode]) => (
              <label key={key} className="space-y-1">
                <span className="text-[11px] text-zinc-600 font-medium">{label}</span>
                <input
                  type={key === "logDate" ? "date" : "number"}
                  inputMode={mode === "date" ? undefined : "decimal"}
                  step="any"
                  value={draft[key]}
                  onChange={(ev) => patchDraft(key, ev.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setPreviewUrl(null);
                setError("");
              }}
              className={`flex-1 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-semibold text-zinc-700 ${btnClass}`}
            >
              {t("inbody.cancel", "取消")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className={`flex-1 py-2.5 rounded-xl ${BRAND_BTN} text-sm font-semibold disabled:opacity-60 ${btnClass}`}
            >
              {saving
                ? t("inbody.saving", "儲存中...")
                : t("inbody.confirmSave", "確認儲存進度")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
