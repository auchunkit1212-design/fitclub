"use client";

import { useRef, useState } from "react";
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

interface NutritionLabelOcrButtonProps {
  onSuccess: (values: OcrNutritionResult) => void;
  className?: string;
}

export function NutritionLabelOcrButton({
  onSuccess,
  className = "",
}: NutritionLabelOcrButtonProps) {
  const { t } = useI18n();
  const labelInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
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
  };

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
        throw new Error(data.error ?? t("nutritionOcr.barcodeError", "條碼辨識失敗，請再影一次"));
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

  const labelProductName =
    labelResult?.brand && labelResult.productName
      ? `${labelResult.brand} ${labelResult.productName}`.trim()
      : labelResult?.productName;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="rounded-xl border border-green-100 bg-green-50/60 px-3 py-2">
        <p className="text-xs font-semibold text-green-900">
          {step === "label"
            ? t("nutritionOcr.step1Title", "第 1 步：拍攝營養標籤")
            : t("nutritionOcr.step2Title", "第 2 步：拍攝條碼")}
        </p>
        <p className="text-[11px] text-green-800/80 mt-0.5">
          {step === "label"
            ? t(
                "nutritionOcr.step1Hint",
                "對準營養成分表，確保文字清晰"
              )
            : t(
                "nutritionOcr.step2Hint",
                "將條碼置於畫面中央，避免反光同模糊"
              )}
        </p>
      </div>

      {labelResult && step === "barcode" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <p className="font-semibold inline-flex items-center gap-1">
            <CheckCircle2 size={14} aria-hidden />
            {t("nutritionOcr.labelCaptured", "已讀取標籤")}
          </p>
          <p className="mt-1">
            {labelProductName} · {labelResult.calories} kcal
          </p>
        </div>
      ) : null}

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

      {step === "label" ? (
        <button
          type="button"
          disabled={scanning}
          onClick={() => labelInputRef.current?.click()}
          className={`w-full bg-green-50 text-green-700 font-semibold py-3 rounded-xl disabled:opacity-60 ${btnClass}`}
        >
          {scanning ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin shrink-0" aria-hidden />
              {t("nutritionOcr.scanning", "大猩猩正在閱讀標籤...")}
            </span>
          ) : (
            <IconLabel
              icon={ScanLine}
              size="md"
              className="justify-center"
              iconClassName="text-green-700"
            >
              {t("nutritionOcr.scanButton", "拍攝營養標籤（第 1 張）")}
            </IconLabel>
          )}
        </button>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            disabled={scanning || !labelResult}
            onClick={() => barcodeInputRef.current?.click()}
            className={`w-full bg-green-600 text-white font-semibold py-3 rounded-xl disabled:opacity-60 ${btnClass}`}
          >
            {scanning ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2
                  size={18}
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
            disabled={scanning}
            onClick={resetFlow}
            className={`w-full text-xs text-green-700 py-2 ${btnClass}`}
          >
            {t("nutritionOcr.rescanLabel", "重新拍攝標籤")}
          </button>
        </div>
      )}

      {error ? (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5 border border-amber-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
