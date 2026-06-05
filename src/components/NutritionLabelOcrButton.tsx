"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { IconLabel, Loader2, ScanLine } from "@/components/icons";
import { compressFileImage } from "@/lib/image";
import type { OcrNutritionValues } from "@/lib/ocr-nutrition";
import { getSessionRequestHeaders } from "@/lib/session";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface NutritionLabelOcrButtonProps {
  onSuccess: (values: OcrNutritionValues) => void;
  className?: string;
}

export function NutritionLabelOcrButton({
  onSuccess,
  className = "",
}: NutritionLabelOcrButtonProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const blurMessage = t(
    "nutritionOcr.blurError",
    "標籤有點模糊，大猩猩看不清楚！請重新拍攝或手動輸入。"
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const data = (await res.json()) as OcrNutritionValues & {
        error?: string;
        blur?: boolean;
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

      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : blurMessage);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={scanning}
        onClick={() => inputRef.current?.click()}
        className={`w-full bg-green-50 text-green-700 font-semibold py-3 rounded-xl disabled:opacity-60 ${btnClass}`}
      >
        {scanning ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin shrink-0" aria-hidden />
            {t("nutritionOcr.scanning", "大猩猩正在閱讀標籤...")}
          </span>
        ) : (
          <IconLabel icon={ScanLine} size="md" className="justify-center" iconClassName="text-green-700">
            {t("nutritionOcr.scanButton", "🔍 自動掃描營養標籤 (AI OCR)")}
          </IconLabel>
        )}
      </button>
      {error && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5 border border-amber-100">
          {error}
        </p>
      )}
    </div>
  );
}
