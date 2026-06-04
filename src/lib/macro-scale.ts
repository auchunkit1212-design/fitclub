export interface MacroEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const MILK_KEYWORDS = [
  "鮮奶",
  "牛奶",
  "全脂奶",
  "脱脂奶",
  "脫脂奶",
  "低脂奶",
  "豆奶",
  "milk",
  "latte",
  "cappuccino",
];

/** 從描述解析容量（ml）；「一杯」預設 200ml */
export function parseVolumeMl(description: string): number | null {
  const desc = description.trim();
  const mlMatch = desc.match(/(\d+(?:\.\d+)?)\s*(?:ml|毫升|mL|ML)/);
  if (mlMatch) {
    const ml = Math.round(parseFloat(mlMatch[1]));
    return ml > 0 && ml <= 2000 ? ml : null;
  }

  const cupMatch = desc.match(/(\d+(?:\.\d+)?)\s*杯/);
  if (cupMatch) {
    const cups = parseFloat(cupMatch[1]);
    if (cups > 0 && cups <= 10) return Math.round(cups * 200);
  }

  if (/一杯/.test(desc)) return 200;

  return null;
}

export function isMilkLikeDescription(description: string): boolean {
  const desc = description.toLowerCase();
  if (MILK_KEYWORDS.some((k) => desc.includes(k.toLowerCase()))) return true;
  if (desc.includes("奶") && !desc.includes("奶茶") && !desc.includes("奶酪")) {
    return true;
  }
  return false;
}

/** 全脂鮮奶：以 250ml 為基準 */
export function estimateMilkMacros(volumeMl: number): MacroEstimate {
  const ml = Math.max(50, Math.min(volumeMl, 1000));
  const factor = ml / 250;
  return {
    calories: Math.round(150 * factor),
    protein: Math.round(8 * factor),
    carbs: Math.round(12 * factor),
    fats: Math.round(8 * factor),
  };
}

export function scaleMacrosToWeight(
  macros: MacroEstimate,
  referenceWeightG: number,
  targetWeightG: number
): MacroEstimate {
  if (referenceWeightG <= 0 || targetWeightG <= 0) return macros;
  const factor = targetWeightG / referenceWeightG;
  return {
    calories: Math.max(0, Math.round(macros.calories * factor)),
    protein: Math.max(0, Math.round(macros.protein * factor)),
    carbs: Math.max(0, Math.round(macros.carbs * factor)),
    fats: Math.max(0, Math.round(macros.fats * factor)),
  };
}
