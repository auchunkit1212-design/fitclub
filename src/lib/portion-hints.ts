import type { MacroEstimate } from "@/lib/macro-scale";

export type PortionSize = "none" | "small" | "medium" | "large";

export type ParsedPortionHints = {
  foodBase: string;
  carbsPortion: PortionSize | null;
  proteinPortion: PortionSize | null;
  hasVeggies: boolean | null;
};

type MacroRange = { min: number; max: number };

/** 拳頭／手掌份量對應宏量營養合理區間（香港教練常用估算） */
const CARBS_GRAMS: Record<Exclude<PortionSize, "none">, MacroRange> = {
  small: { min: 25, max: 45 },
  medium: { min: 40, max: 60 },
  large: { min: 55, max: 85 },
};

const PROTEIN_GRAMS: Record<Exclude<PortionSize, "none">, MacroRange> = {
  small: { min: 12, max: 22 },
  medium: { min: 20, max: 32 },
  large: { min: 30, max: 45 },
};

const SOUP_DISH_KEYWORDS = [
  "湯",
  "拉麵",
  "烏冬",
  "麵",
  "米线",
  "米線",
  "云吞",
  "雲吞",
  "牛腩",
  "煲",
  "soup",
  "ramen",
  "udon",
];

function normalizePortionToken(raw: string): PortionSize | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;

  if (
    /^(無|冇|0|none|n\/a|na)$/.test(token) ||
    token.includes("冇食") ||
    token.includes("无") ||
    token === "none (0)"
  ) {
    return "none";
  }

  if (/^(細|小|small)/.test(token)) return "small";
  if (/^(中|medium)/.test(token)) return "medium";
  if (/^(大|large)/.test(token)) return "large";

  if (token.includes("細拳") || token.includes("小拳") || token.includes("small fist")) {
    return "small";
  }
  if (token.includes("中拳") || token.includes("medium fist")) return "medium";
  if (token.includes("大拳") || token.includes("large fist")) return "large";

  if (token.includes("細掌") || token.includes("小掌") || token.includes("small palm")) {
    return "small";
  }
  if (token.includes("中掌") || token.includes("medium palm")) return "medium";
  if (token.includes("大掌") || token.includes("large palm")) return "large";

  return null;
}

function parseCarbsPortion(text: string): PortionSize | null {
  const match = text.match(/(?:澱粉|碳水)\s*([^；;]+)/i);
  if (!match) return null;
  return normalizePortionToken(match[1]);
}

function parseProteinPortion(text: string): PortionSize | null {
  const match = text.match(/蛋白(?:質)?\s*([^；;]+)/i);
  if (!match) return null;
  return normalizePortionToken(match[1]);
}

function parseVeggies(text: string): boolean | null {
  if (/有蔬菜|有菜|有veg/i.test(text)) return true;
  if (/無蔬菜|冇蔬菜|无蔬菜|無菜|冇菜|no veg/i.test(text)) return false;
  return null;
}

/** 從學員描述括號內容解析拳頭／手掌份量標記 */
export function parsePortionHintsFromDescription(description: string): ParsedPortionHints {
  const trimmed = description.trim();
  const portionMatch = trimmed.match(/^(.+?)（(.+)）$/);

  if (!portionMatch) {
    return {
      foodBase: trimmed,
      carbsPortion: null,
      proteinPortion: null,
      hasVeggies: null,
    };
  }

  const foodBase = portionMatch[1].trim();
  const hintsBlock = portionMatch[2];

  return {
    foodBase,
    carbsPortion: parseCarbsPortion(hintsBlock),
    proteinPortion: parseProteinPortion(hintsBlock),
    hasVeggies: parseVeggies(hintsBlock),
  };
}

function isSoupLikeMeal(foodBase: string): boolean {
  const lower = foodBase.toLowerCase();
  return SOUP_DISH_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMacro(value: number): number {
  return Math.max(0, Math.round(value));
}

function macroCalories(macros: MacroEstimate): number {
  return macros.protein * 4 + macros.carbs * 4 + macros.fats * 9;
}

function reconcileCalories(macros: MacroEstimate): MacroEstimate {
  const macroKcal = macroCalories(macros);
  const calories = macros.calories > 0 ? macros.calories : macroKcal;
  const lower = Math.round(macroKcal * 0.85);
  const upper = Math.round(macroKcal * 1.15);

  if (calories >= lower && calories <= upper) {
    return macros;
  }

  return { ...macros, calories: macroKcal };
}

function portionLabel(size: PortionSize, unit: "拳" | "掌"): string {
  if (size === "none") return "無";
  const map = { small: "細", medium: "中", large: "大" } as const;
  return `${map[size]}${unit}`;
}

/** 生成 AI 必讀份量指引（學員已選的拳／掌標記） */
export function buildPortionGuidanceBlock(hints: ParsedPortionHints): string {
  const lines: string[] = [];

  if (hints.carbsPortion) {
    if (hints.carbsPortion === "none") {
      lines.push("- 澱粉：學員標記【無／冇食】→ 碳水應接近 0–15g（僅醬料微量）");
    } else {
      const range = CARBS_GRAMS[hints.carbsPortion];
      lines.push(
        `- 澱粉：${portionLabel(hints.carbsPortion, "拳")} → 碳水約 ${range.min}–${range.max}g（只計澱粉主食，不可按整碗麵/飯默認份量）`
      );
    }
  }

  if (hints.proteinPortion) {
    if (hints.proteinPortion === "none") {
      lines.push("- 蛋白質：學員標記【無／冇食】→ 肉類蛋白應 0–8g（湯底膠原蛋白另計）");
    } else {
      const range = PROTEIN_GRAMS[hints.proteinPortion];
      lines.push(
        `- 蛋白質：${portionLabel(hints.proteinPortion, "掌")} → 肉類蛋白約 ${range.min}–${range.max}g（只計可見肉／魚／蛋，不可按整碗叉燒／牛肉／雞排計算）`
      );
    }
  }

  if (hints.hasVeggies === false) {
    lines.push("- 蔬菜：無 → 不要為蔬菜加入額外碳水");
  } else if (hints.hasVeggies === true) {
    lines.push("- 蔬菜：有 → 可加入約 3–8g 碳水及少量纖維");
  }

  if (lines.length === 0) return "";

  return `\n【學員份量標記 — 必須嚴格遵守，覆蓋預設整碗／整碟估算】\n${lines.join("\n")}\n若描述含拉麵／湯麵等，隱形熱量（湯底油、醬汁）計入脂肪同總熱量，但蛋白質仍受手掌大小上限約束。`;
}

/** AI 回傳後，按學員拳／掌標記修正宏量（防止整碗默認值蓋過小掌） */
export function constrainMacrosToPortionHints(
  macros: MacroEstimate,
  hints: ParsedPortionHints
): { macros: MacroEstimate; note?: string; adjusted: boolean } {
  if (!hints.carbsPortion && !hints.proteinPortion) {
    return { macros, adjusted: false };
  }

  let { calories, protein, carbs, fats } = macros;
  const adjustments: string[] = [];
  const soupBonus = isSoupLikeMeal(hints.foodBase) ? 3 : 0;

  if (hints.carbsPortion === "none") {
    if (carbs > 15) {
      carbs = clamp(carbs, 0, 15);
      adjustments.push("澱粉標記無，已下調碳水");
    }
  } else if (
    hints.carbsPortion === "small" ||
    hints.carbsPortion === "medium" ||
    hints.carbsPortion === "large"
  ) {
    const range = CARBS_GRAMS[hints.carbsPortion];
    if (carbs < range.min || carbs > range.max) {
      const before = carbs;
      carbs = clamp(carbs, range.min, range.max);
      adjustments.push(`碳水由 ${before}g 調整至 ${carbs}g（配合${portionLabel(hints.carbsPortion, "拳")}）`);
    }
  }

  if (hints.proteinPortion === "none") {
    const maxProtein = 8 + soupBonus;
    if (protein > maxProtein) {
      const before = protein;
      protein = clamp(protein, 0, maxProtein);
      adjustments.push(`蛋白標記無，由 ${before}g 調至 ${protein}g`);
    }
  } else if (
    hints.proteinPortion === "small" ||
    hints.proteinPortion === "medium" ||
    hints.proteinPortion === "large"
  ) {
    const range = PROTEIN_GRAMS[hints.proteinPortion];
    const maxProtein = range.max + soupBonus;
    const minProtein = range.min;
    if (protein > maxProtein) {
      const before = protein;
      protein = clamp(protein, minProtein, maxProtein);
      adjustments.push(
        `蛋白由 ${before}g 調至 ${protein}g（配合${portionLabel(hints.proteinPortion, "掌")}，非整碗肉量）`
      );
    } else if (protein < minProtein && protein > 0) {
      const before = protein;
      protein = minProtein;
      adjustments.push(`蛋白由 ${before}g 調至 ${protein}g（配合${portionLabel(hints.proteinPortion, "掌")}）`);
    }
  }

  const adjusted = adjustments.length > 0;
  const rounded: MacroEstimate = {
    calories: roundMacro(calories),
    protein: roundMacro(protein),
    carbs: roundMacro(carbs),
    fats: roundMacro(fats),
  };

  const reconciled = reconcileCalories(rounded);

  return {
    macros: reconciled,
    note: adjustments.length > 0 ? adjustments.join("；") : undefined,
    adjusted,
  };
}
