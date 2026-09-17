"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  buildPortionedDescription,
  ratioFromGrams,
  ratioFromPreset,
  type PortionPreset,
} from "@/lib/portion-scale";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const PRESETS: PortionPreset[] = ["full", "half", "third", "quarter"];

type Props = {
  baseWeightG?: number;
  productName?: string;
  onPortionChange: (ratio: number, portionLabel: string, description: string) => void;
  className?: string;
};

export function ServingPortionPicker({
  baseWeightG,
  productName = "",
  onPortionChange,
  className = "",
}: Props) {
  const { t } = useI18n();
  const [preset, setPreset] = useState<PortionPreset>("full");
  const [customGrams, setCustomGrams] = useState(
    baseWeightG && baseWeightG > 0 ? Math.round(baseWeightG / 2) : 50
  );

  const presetLabel = (key: PortionPreset): string => {
    switch (key) {
      case "full":
        return t("portion.full", "全份");
      case "half":
        return t("portion.half", "半份");
      case "third":
        return t("portion.third", "⅓ 份");
      case "quarter":
        return t("portion.quarter", "¼ 份");
      default:
        return "";
    }
  };

  const onChangeRef = useRef(onPortionChange);
  onChangeRef.current = onPortionChange;

  useEffect(() => {
    let ratio = ratioFromPreset(preset);
    let label = presetLabel(preset);

    if (preset === "custom" && baseWeightG && baseWeightG > 0) {
      ratio = ratioFromGrams(customGrams, baseWeightG);
      label = t("portion.gramsEaten", "食咗 {grams}g / {base}g", {
        grams: customGrams,
        base: baseWeightG,
      });
    } else if (baseWeightG && baseWeightG > 0 && preset !== "full") {
      const g = Math.round(baseWeightG * ratio);
      label = `${presetLabel(preset)} · ${g}g`;
    } else if (baseWeightG && baseWeightG > 0 && preset === "full") {
      label = `${presetLabel(preset)} · ${baseWeightG}g`;
    }

    const description = buildPortionedDescription(productName, label);
    onChangeRef.current(ratio, label, description);
  }, [preset, customGrams, baseWeightG, productName, t]);

  return (
    <div
      className={`rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 space-y-3 ${className}`}
    >
      <p className="text-xs font-semibold text-emerald-800">
        {t("portion.title", "你食咗幾多？")}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            className={`py-2 px-1 rounded-xl text-xs font-semibold border ${btnClass} ${
              preset === key
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-emerald-800 border-emerald-200"
            }`}
          >
            {presetLabel(key)}
          </button>
        ))}
      </div>
      {baseWeightG && baseWeightG > 0 ? (
        <div>
          <label className="text-xs text-emerald-900/80 block mb-1">
            {t("portion.customGrams", "或輸入實際克數")}
            <span className="text-emerald-600/70 ml-1">
              ({t("portion.perServing", "每份 {g}g", { g: baseWeightG })})
            </span>
          </label>
          <input
            type="number"
            min={1}
            max={baseWeightG}
            value={customGrams}
            onChange={(e) => {
              setPreset("custom");
              setCustomGrams(Math.max(1, Number(e.target.value) || 1));
            }}
            onFocus={() => setPreset("custom")}
            className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm"
          />
        </div>
      ) : (
        <p className="text-[11px] text-emerald-700/80">
          {t(
            "portion.noWeightHint",
            "標籤無份量克數時，請用半份／⅓ 份等比例估算。"
          )}
        </p>
      )}
    </div>
  );
}
