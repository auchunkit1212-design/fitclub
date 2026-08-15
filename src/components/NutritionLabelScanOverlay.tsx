"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  Barcode,
  CheckCircle2,
  IconLabel,
  Loader2,
  ScanLine,
} from "@/components/icons";
import { compressFileImage } from "@/lib/image";
import type { OcrNutritionResult } from "@/lib/ocr-nutrition";
import { getSessionRequestHeaders } from "@/lib/session";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type ScanStep = "label" | "barcode";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (values: OcrNutritionResult) => void;
  /** Auto-open camera picker when overlay mounts */
  autoLaunch?: boolean;
};

export function NutritionLabelScanOverlay({
  open,
  onClose,
  onSuccess,
  autoLaunch = true,
}: Props) {
  const { t } = useI18n();
  const labelInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const autoLaunchedRef = useRef(false);
  const [step, setStep] = useState<ScanStep>("label");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [labelResult, setLabelResult] = useState<OcrNutritionResult | null>(
    null
  );

  const blurMessage = t(
    "nutritionOcr.blurError",
    "標籤有點模糊，大猩猩看不清楚！請重新拍攝或手動輸入。"
  );

  const resetFlow = () => {
    setStep("label");
    setLabelResult(null);
    setError("");
    autoLaunchedRef.current = false;
  };

  useEffect(() => {
    if (!open) {
      resetFlow();
      return;
    }
    if (!autoLaunch || autoLaunchedRef.current) return;
    autoLaunchedRef.current = true;
    const timer = window.setTimeout(() => {
      labelInputRef.current?.click();
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoLaunch]);

  if (!open) return null;

  const handleLabelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setScanning(true);

    try {
      const dataUrl = await compressFileImage(file);
      const res = await fetch("/api/ocr-nutrition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = (await res.json()) as OcrNutritionResult & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? blurMessage);
      }

      const allZero =
        data.calories === 0 &&
        data.protein === 0 &&
        data.carbs === 0 &&
        data.fat === 0 &&
        data.sodium === 0 &&
        data.sugar === 0;
      if (allZero) {
        setError(blurMessage);
        return;
      }

      setLabelResult(data);
      setStep("barcode");
      // 即時帶入表單，唔使等條碼先見到標籤數值
      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : blurMessage);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  };

  const handleBarcodeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !labelResult) return;
    setError("");
    setScanning(true);

    try {
      const dataUrl = await compressFileImage(file);
      const res = await fetch("/api/ocr-barcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          imageBase64: dataUrl,
          labelResult,
        }),
      });
      const data = (await res.json()) as OcrNutritionResult & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(
          data.error ?? t("nutritionOcr.barcodeError", "條碼辨識失敗，請再影一次")
        );
      }

      onSuccess(data);
      resetFlow();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("nutritionOcr.barcodeError", "條碼辨識失敗，請再影一次")
      );
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  };

  const skipBarcodeAndFinish = () => {
    if (!labelResult) return;
    onSuccess(labelResult);
    resetFlow();
  };

  const labelProductName =
    labelResult?.brand && labelResult.productName
      ? `${labelResult.brand} ${labelResult.productName}`.trim()
      : labelResult?.productName;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-zinc-950/95 animate-fade-slide-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-scan-title"
    >
      <div className="pt-safe px-4 pb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            resetFlow();
            onClose();
          }}
          className={`text-sm font-semibold text-white/90 px-2 py-2 ${btnClass}`}
        >
          {t("header.back", "← 返回")}
        </button>
        <p
          id="ocr-scan-title"
          className="text-sm font-bold text-white truncate"
        >
          {step === "label"
            ? t("nutritionOcr.overlayTitle", "AI 掃描營養標籤")
            : t("nutritionOcr.step2Title", "第 2 步：拍攝條碼")}
        </p>
        <span className="w-14" aria-hidden />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-black/40" />

          {/* Scan frame */}
          <div className="absolute inset-[12%] rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
            <span className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-[3px] border-l-[3px] border-emerald-300 rounded-tl-xl" />
            <span className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-[3px] border-r-[3px] border-emerald-300 rounded-tr-xl" />
            <span className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-[3px] border-l-[3px] border-emerald-300 rounded-bl-xl" />
            <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-[3px] border-r-[3px] border-emerald-300 rounded-br-xl" />
            <div className="absolute left-[8%] right-[8%] h-0.5 bg-emerald-300/80 animate-scan-line shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 text-center space-y-2">
            <p className="text-sm font-semibold text-white leading-relaxed">
              {step === "label"
                ? t(
                    "nutritionOcr.overlayHint",
                    "請對準背後營養標籤，AI 將自動讀取卡路里"
                  )
                : t(
                    "nutritionOcr.step2Hint",
                    "將條碼置於畫面中央，避免反光同模糊"
                  )}
            </p>
            {labelResult && step === "barcode" ? (
              <p className="text-xs text-emerald-200 inline-flex items-center gap-1 justify-center">
                <CheckCircle2 size={14} aria-hidden />
                {labelProductName} · {labelResult.calories} kcal
              </p>
            ) : null}
          </div>
        </div>

        <input
          ref={labelInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleLabelFile}
        />
        <input
          ref={barcodeInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleBarcodeFile}
        />

        <div className="w-full max-w-sm mt-6 space-y-3">
          {step === "label" ? (
            <button
              type="button"
              disabled={scanning}
              onClick={() => labelInputRef.current?.click()}
              className={`w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base disabled:opacity-60 ${btnClass}`}
            >
              {scanning ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2
                    size={20}
                    className="animate-spin shrink-0"
                    aria-hidden
                  />
                  {t("nutritionOcr.scanning", "大猩猩正在閱讀標籤...")}
                </span>
              ) : (
                <IconLabel
                  icon={ScanLine}
                  size="md"
                  className="justify-center"
                  iconClassName="text-white"
                >
                  {t("nutritionOcr.scanButton", "拍攝營養標籤（第 1 張）")}
                </IconLabel>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={scanning || !labelResult}
                onClick={() => barcodeInputRef.current?.click()}
                className={`w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base disabled:opacity-60 ${btnClass}`}
              >
                {scanning ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2
                      size={20}
                      className="animate-spin shrink-0"
                      aria-hidden
                    />
                    {t("nutritionOcr.scanningBarcode", "讀取條碼中...")}
                  </span>
                ) : (
                  <IconLabel
                    icon={Barcode}
                    size="md"
                    className="justify-center"
                    iconClassName="text-white"
                  >
                    {t("nutritionOcr.scanBarcodeButton", "拍攝條碼（第 2 張）")}
                  </IconLabel>
                )}
              </button>
              <button
                type="button"
                disabled={scanning || !labelResult}
                onClick={skipBarcodeAndFinish}
                className={`w-full py-3 rounded-2xl bg-white/10 text-white font-semibold text-sm ${btnClass}`}
              >
                {t("nutritionOcr.skipBarcode", "略過條碼，直接使用標籤結果")}
              </button>
              <button
                type="button"
                disabled={scanning}
                onClick={() => {
                  setStep("label");
                  setLabelResult(null);
                  setError("");
                }}
                className={`w-full py-2 text-xs text-white/70 ${btnClass}`}
              >
                {t("nutritionOcr.rescanLabel", "重新拍攝標籤")}
              </button>
            </>
          )}

          {error ? (
            <p className="text-xs text-amber-100 bg-amber-500/20 border border-amber-400/30 rounded-xl px-3 py-2.5 leading-relaxed">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
