"use client";

import { useRef, useState } from "react";
import type { NutritionLabelResult } from "@/lib/vision-label";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface SnackLabelScannerProps {
  onApplyPerPiece: (caloriesPerPiece: number, details?: NutritionLabelResult) => void;
}

export function SnackLabelScanner({ onApplyPerPiece }: SnackLabelScannerProps) {
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
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = (await res.json()) as {
        result?: NutritionLabelResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "掃描失敗");

      setResult(data.result ?? null);
      if (data.result) {
        onApplyPerPiece(data.result.caloriesPerPiece, data.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "掃描失敗");
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
        className={`w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-60 ${btnClass}`}
      >
        {scanning ? "AI 辨識標籤中..." : "📸 拍攝營養標籤"}
      </button>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>
      )}
      {result && (
        <div className="text-xs bg-indigo-50 text-indigo-900 rounded-xl p-3 space-y-1">
          <p className="font-semibold">{result.productName}</p>
          <p>
            每份 {result.caloriesPerServing} kcal（{result.servingSize}）· 共{" "}
            {result.servingsPerPackage} 份
          </p>
          <p className="font-bold text-indigo-700">
            → 每件約 {result.caloriesPerPiece} kcal（已填入）
          </p>
          {result.notes && <p className="text-indigo-700/80">{result.notes}</p>}
          <p className="text-[10px] text-indigo-500">
            引擎：{result.source === "openai" ? "GPT-4o Vision" : "示範模式"}
          </p>
        </div>
      )}
    </div>
  );
}
