"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { NutritionLabelResult } from "@/lib/vision-label";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface SnackLabelScannerProps {
  onApplyPerPiece: (caloriesPerPiece: number, details?: NutritionLabelResult) => void;
}

export function SnackLabelScanner({ onApplyPerPiece }: SnackLabelScannerProps) {
  const { lang, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<NutritionLabelResult | null>(null);
  const [error, setError] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setScanning(true);
    setResult(null);

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/ai/nutrition-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl, lang }),
      });
      const data = (await res.json()) as {
        result?: NutritionLabelResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("foodSearch.searchFailed", "掃描失敗"));

      setResult(data.result ?? null);
      if (data.result) {
        onApplyPerPiece(data.result.caloriesPerPiece, data.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("foodSearch.searchFailed", "掃描失敗"));
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
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
        className={`w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl disabled:opacity-60 ${btnClass}`}
      >
        {scanning
          ? t("snackScanner.scanning", "AI 辨識標籤中...")
          : t("snackScanner.scanButton", "📸 拍攝營養標籤")}
      </button>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>
      )}
      {result && (
        <div className="text-xs bg-emerald-50 text-gray-800 rounded-xl p-3 space-y-1 border border-emerald-200">
          <p className="font-semibold">{result.productName}</p>
          <p>
            {t("snackScanner.perServing", "每份 {cal} kcal（{size}）· 共 {count} 份", {
              cal: result.caloriesPerServing,
              size: result.servingSize,
              count: result.servingsPerPackage,
            })}
          </p>
          <p className="font-bold text-emerald-700">
            {t("snackScanner.perPiece", "→ 每件約 {cal} kcal（已填入）", {
              cal: result.caloriesPerPiece,
            })}
          </p>
          {result.notes && <p className="text-gray-600">{result.notes}</p>}
          <p className="text-[10px] text-emerald-700">
            {result.source === "openai"
              ? t("snackScanner.engineOpenAi", "引擎：GPT-4o Vision")
              : t("snackScanner.engineMock", "引擎：示範模式")}
          </p>
        </div>
      )}
    </div>
  );
}
