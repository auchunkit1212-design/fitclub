import {
  formatCompositeBreakdown,
  splitMealDescription,
  sumMacros,
} from "@/lib/composite-meal";
import { searchHkFoodDatabase } from "@/lib/food-search/hk-fallback";
import {
  estimateMilkMacros,
  isMilkLikeDescription,
  parseVolumeMl,
  type MacroEstimate,
} from "@/lib/macro-scale";

export type { MacroEstimate } from "@/lib/macro-scale";

export const PORTION_NONE = "無 / 冇食 (0)";

/**
 * AI 卡路里估算系統指令（外食與隱形熱量修正）
 * 用於未來接入 LLM 時；現時 estimateMacros 依此規則實作。
 */
export const AI_CALORIE_SYSTEM_PROMPT = `你是香港飲食卡路里估算專家。必須遵守：

1. 外食隱形熱量：遇到「湯麵、拉麵、烏冬、茶餐廳、炒、炸、煲、腩、叉燒、油」等字眼，必須把高脂肪湯底（牛骨湯、豚骨湯）、紅油、濃醬汁、烹調用油計入總熱量，不可只算麵與肉。
2. 合理區間：一碗牛肉叉燒拉麵必須落在 700–900 kcal；茶餐廳乾炒牛河 850–1100 kcal；炸物套餐 +200–350 kcal 油分。
3. 飲品：全糖奶茶/檸茶 250–350 kcal；走甜仍保留 80–120 kcal。
4. 嚴禁過低估算：寧可偏高 10% 亦不可低於外食實際常識下限。
5. 你是一位嚴謹營養師，輸出必須符合現實常理與生物學。水果類（蘋果、橙、香蕉、莓果等）必須以碳水為主，脂肪通常接近 0。
6. 必須檢查熱量公式：(碳水g * 4) + (蛋白質g * 4) + (脂肪g * 9) 要與總熱量大致一致（容許約 ±15% 誤差）。
7. 輸出：calories, protein_g, carbs_g, fats_g 整數，並附一句隱形熱量說明。`;

const HIGH_CAL_KEYWORDS = ["炒飯", "牛河", "乾炒", "焗飯", "公仔麵", "即食麵", "炸"];
const OUTDOOR_HIDDEN_CAL = [
  "湯麵",
  "拉麵",
  "烏冬",
  "茶餐廳",
  "炒",
  "炸",
  "煲",
  "牛腩",
  "叉燒",
  "油麵",
  "雲吞",
  "米線",
  "麻辣",
  "紅油",
  "腩",
];
const RAMEN_KEYWORDS = ["拉麵", "叉燒", "牛肉", "豚骨", "湯麵"];
const LOW_RICE_KEYWORDS = ["少飯", "走飯", "少油"];
const FRUIT_KEYWORDS = [
  "蘋果",
  "apple",
  "橙",
  "orange",
  "香蕉",
  "banana",
  "士多啤梨",
  "草莓",
  "莓",
  "藍莓",
  "奇異果",
  "kiwi",
  "水果",
  "fruit",
  "fruit",
];
const DRINK_KEYWORDS = [
  "latte",
  "cappuccino",
  "americano",
  "coffee",
  "espresso",
  "mocha",
  "奶茶",
  "檸茶",
  "茶",
  "tea",
  "juice",
  "smoothie",
  "啤酒",
  "beer",
  "wine",
];

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function applyHiddenCalorieFloor(
  desc: string,
  estimate: MacroEstimate
): MacroEstimate {
  let { calories, protein, carbs, fats } = estimate;

  if (
    matchesAny(desc, RAMEN_KEYWORDS) &&
    (desc.includes("拉麵") || desc.includes("湯麵") || desc.includes("叉燒"))
  ) {
    calories = Math.max(calories, 720);
    if (desc.includes("牛肉") && desc.includes("叉燒")) {
      calories = Math.max(calories, 780);
      calories = Math.min(calories, 920);
    }
    fats = Math.max(fats, 28);
    protein = Math.max(protein, 32);
    carbs = Math.max(carbs, 75);
  }

  if (matchesAny(desc, OUTDOOR_HIDDEN_CAL)) {
    const oilBonus = desc.includes("炸") ? 220 : desc.includes("炒") ? 160 : 120;
    calories = Math.max(calories, 650) + (calories < 700 ? oilBonus * 0.35 : 0);
    fats = Math.max(fats, fats + 12);
  }

  if (desc.includes("茶餐廳") || desc.includes("常餐")) {
    calories = Math.max(calories, 880);
    fats = Math.max(fats, 36);
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
  };
}

function enforceMacroCalorieConsistency(estimate: MacroEstimate): MacroEstimate {
  const protein = Math.max(0, Math.round(estimate.protein));
  const carbs = Math.max(0, Math.round(estimate.carbs));
  const fats = Math.max(0, Math.round(estimate.fats));
  const macroCalories = protein * 4 + carbs * 4 + fats * 9;
  const calories = Math.max(0, Math.round(estimate.calories));
  if (macroCalories <= 0) {
    return { calories, protein, carbs, fats };
  }

  const lower = Math.round(macroCalories * 0.85);
  const upper = Math.round(macroCalories * 1.15);
  if (calories >= lower && calories <= upper) {
    return { calories, protein, carbs, fats };
  }

  return {
    calories: macroCalories,
    protein,
    carbs,
    fats,
  };
}

/** 單一食物片段估算（不含拳頭/掌份量調整） */
export function estimateSingleItemCore(description: string): MacroEstimate {
  const desc = description.toLowerCase().trim();

  if (isMilkLikeDescription(desc)) {
    const ml = parseVolumeMl(description) ?? 250;
    return enforceMacroCalorieConsistency(estimateMilkMacros(ml));
  }

  const hkHits = searchHkFoodDatabase(description);
  if (hkHits.length > 0) {
    const best = hkHits[0];
    return enforceMacroCalorieConsistency({
      calories: best.calories,
      protein: best.protein,
      carbs: best.carbs,
      fats: best.fats,
    });
  }

  let calories = 280;
  let protein = 12;
  let carbs = 28;
  let fats = 12;

  if (matchesAny(desc, FRUIT_KEYWORDS)) {
    calories = 95;
    protein = 1;
    carbs = 24;
    fats = 0;
  } else if (
    desc.includes("漢堡餐") ||
    desc.includes("超值餐") ||
    (desc.includes("餐") && (desc.includes("堡") || desc.includes("麥")))
  ) {
    calories = 520;
    protein = 22;
    carbs = 48;
    fats = 26;
  } else if (
    desc.includes("豬柳蛋") ||
    desc.includes("麥香雞") ||
    desc.includes("巨無霸") ||
    desc.includes("漢堡") ||
    desc.includes("burger")
  ) {
    calories = 380;
    protein = 18;
    carbs = 32;
    fats = 20;
  } else if (
    desc.includes("雞腿") ||
    desc.includes("炸雞") ||
    desc.includes("雞髀") ||
    desc.includes("thigh") ||
    desc.includes("crispy")
  ) {
    calories = 300;
    protein = 22;
    carbs = 12;
    fats = 18;
  } else if (desc.includes("薯條") || desc.includes("fries")) {
    calories = 320;
    protein = 4;
    carbs = 42;
    fats = 15;
  } else if (matchesAny(desc, HIGH_CAL_KEYWORDS)) {
    calories = 920;
    protein = 32;
    carbs = 82;
    fats = 42;
  } else if (matchesAny(desc, OUTDOOR_HIDDEN_CAL)) {
    calories = 780;
    protein = 30;
    carbs = 72;
    fats = 34;
  } else if (desc.includes("奶茶") || desc.includes("檸茶")) {
    calories = desc.includes("走甜") ? 95 : 310;
    protein = 4;
    carbs = desc.includes("走甜") ? 12 : 48;
    fats = desc.includes("走甜") ? 2 : 12;
  } else if (
    desc.includes("latte") ||
    desc.includes("cappuccino") ||
    desc.includes("mocha")
  ) {
    calories = desc.includes("冰") || desc.includes("ice") ? 150 : 135;
    protein = 9;
    carbs = 12;
    fats = 6;
  } else if (desc.includes("americano") || desc.includes("espresso")) {
    calories = 5;
    protein = 0;
    carbs = 1;
    fats = 0;
  } else if (desc.includes("coffee") && !desc.includes("cake")) {
    calories = 120;
    protein = 4;
    carbs = 10;
    fats = 5;
  } else if (matchesAny(desc, DRINK_KEYWORDS)) {
    calories = 150;
    protein = 2;
    carbs = 28;
    fats = 2;
  } else if (desc.includes("三文治") || desc.includes("多士")) {
    calories = 420;
    protein = 16;
    carbs = 44;
    fats = 20;
  } else if (desc.includes("通粉") || desc.includes("意粉")) {
    calories = 580;
    protein = 24;
    carbs = 68;
    fats = 22;
  }

  if (LOW_RICE_KEYWORDS.some((k) => desc.includes(k))) {
    calories -= 100;
    carbs -= 24;
    fats -= 6;
  }

  return enforceMacroCalorieConsistency(
    applyHiddenCalorieFloor(desc, {
      calories: Math.max(0, Math.round(calories)),
      protein: Math.max(0, Math.round(protein)),
      carbs: Math.max(0, Math.round(carbs)),
      fats: Math.max(0, Math.round(fats)),
    })
  );
}

export type MacroEstimateResult = {
  macros: MacroEstimate;
  isComposite: boolean;
  parts: { name: string; macros: MacroEstimate }[];
};

export function estimateMacrosWithBreakdown(
  description: string,
  carbsPortion: string,
  proteinPortion: string,
  hasVeggies: string
): MacroEstimateResult {
  const parts = splitMealDescription(description);
  if (parts.length > 1) {
    const breakdown = parts.map((name) => ({
      name,
      macros: estimateSingleItemCore(name),
    }));
    const total = enforceMacroCalorieConsistency(
      applyHiddenCalorieFloor(
        description.toLowerCase(),
        sumMacros(breakdown.map((p) => p.macros))
      )
    );
    return { macros: total, isComposite: true, parts: breakdown };
  }

  return {
    macros: estimateMacros(description, carbsPortion, proteinPortion, hasVeggies),
    isComposite: false,
    parts: [],
  };
}

export function estimateMacros(
  description: string,
  carbsPortion: string,
  proteinPortion: string,
  hasVeggies: string
): MacroEstimate {
  const parts = splitMealDescription(description);
  if (parts.length > 1) {
    return estimateMacrosWithBreakdown(
      description,
      carbsPortion,
      proteinPortion,
      hasVeggies
    ).macros;
  }

  const desc = description.toLowerCase();

  if (isMilkLikeDescription(desc)) {
    const ml = parseVolumeMl(description) ?? 250;
    return enforceMacroCalorieConsistency(estimateMilkMacros(ml));
  }

  let base = estimateSingleItemCore(description);
  let { calories, protein, carbs, fats } = base;

  const isFruitMeal = matchesAny(desc, FRUIT_KEYWORDS);

  if (!isFruitMeal) {
    if (carbsPortion === PORTION_NONE) {
      carbs = 0;
      calories -= 180;
      fats -= 4;
    } else {
      if (carbsPortion === "大拳") calories += 80;
      if (carbsPortion === "細拳") calories -= 60;
    }
  }

  if (!isFruitMeal) {
    if (proteinPortion === PORTION_NONE) {
      protein = 0;
      calories -= 120;
      fats -= 6;
    } else {
      if (proteinPortion === "大掌") protein += 18;
      if (proteinPortion === "細掌") protein -= 10;
    }
  }

  if (hasVeggies === "有") {
    calories -= 20;
    carbs -= 5;
  }

  return enforceMacroCalorieConsistency(
    applyHiddenCalorieFloor(desc, {
      calories: Math.max(0, Math.round(calories)),
      protein: Math.max(0, Math.round(protein)),
      carbs: Math.max(0, Math.round(carbs)),
      fats: Math.max(0, Math.round(fats)),
    })
  );
}

const LEAN_PROTEIN_KEYWORDS = [
  "chicken breast",
  "skinless chicken",
  "雞胸",
  "turkey breast",
  "salmon",
  "tuna",
  "cod",
  "shrimp",
  "prawn",
  "egg white",
  "protein shake",
  "whey",
];

/** 食物搜尋專用估算（不套用整餐拳頭/手掌份量） */
export function estimateFoodSearchMacros(description: string): MacroEstimate {
  const desc = description.toLowerCase().trim();

  if (desc.includes("chicken breast") || desc.includes("skinless chicken") || desc.includes("雞胸")) {
    return { calories: 165, protein: 31, carbs: 0, fats: 4 };
  }
  if (matchesAny(desc, LEAN_PROTEIN_KEYWORDS)) {
    return { calories: 180, protein: 28, carbs: 0, fats: 6 };
  }
  if (desc.includes("chicken") || desc.includes("雞")) {
    return { calories: 200, protein: 26, carbs: 0, fats: 9 };
  }
  if (desc.includes("beef") || desc.includes("steak") || desc.includes("牛")) {
    return { calories: 250, protein: 26, carbs: 0, fats: 15 };
  }
  if (desc.includes("rice") || desc.includes("飯")) {
    return { calories: 260, protein: 5, carbs: 58, fats: 1 };
  }
  if (
    desc.includes("latte") ||
    desc.includes("cappuccino") ||
    desc.includes("mocha")
  ) {
    return { calories: 135, protein: 9, carbs: 12, fats: 6 };
  }
  if (desc.includes("burger") || desc.includes("漢堡")) {
    return { calories: 540, protein: 25, carbs: 45, fats: 28 };
  }
  if (
    desc.includes("brownie") ||
    desc.includes("cookie") ||
    desc.includes("donut") ||
    desc.includes("doughnut") ||
    desc.includes("chocolate")
  ) {
    return { calories: 180, protein: 2, carbs: 26, fats: 7 };
  }
  if (
    desc.includes("cake") ||
    desc.includes("loaf") ||
    desc.includes("muffin") ||
    desc.includes("pastry") ||
    desc.includes("pie") ||
    desc.includes("蛋糕") ||
    desc.includes("包")
  ) {
    return { calories: 280, protein: 4, carbs: 39, fats: 12 };
  }
  if (matchesAny(desc, FRUIT_KEYWORDS)) {
    return { calories: 95, protein: 1, carbs: 24, fats: 0 };
  }

  // 勿走 estimateMacros：PORTION_NONE + enforceMacroCalorieConsistency 會把熱量壓成僅脂肪熱量（例如 54 kcal）
  return { calories: 250, protein: 8, carbs: 30, fats: 10 };
}

import { t, type AppLanguage } from "./i18n";

export function generateRoast(
  todayCalories: number,
  targetCalories: number,
  todayProtein: number,
  targetProtein: number,
  lang: AppLanguage = "zh-HK"
): string {
  const calRatio = todayCalories / targetCalories;
  const proRatio = todayProtein / targetProtein;

  if (todayCalories === 0) {
    return t(lang, "ai.roast.empty", "仲未食嘢？唔好餓壞個胃呀，記得記低你食咗咩！");
  }
  if (calRatio > 1.25) {
    return t(lang, "ai.roast.overCalHigh", "食咁多乾炒牛河唔怪之得減唔到肥啦！");
  }
  if (calRatio > 1.05) {
    return t(lang, "ai.roast.overCalMild", "今日有啲放縱喎，茶餐廳陷阱要小心！");
  }
  if (calRatio < 0.6) {
    return t(lang, "ai.roast.underCal", "食咁少？記得食夠蛋白質呀！");
  }
  if (proRatio < 0.7) {
    return t(lang, "ai.roast.lowProtein", "蛋白質唔夠喎，加啲雞胸或者蛋啦！");
  }
  if (calRatio >= 0.85 && calRatio <= 1.05 && proRatio >= 0.9) {
    return t(lang, "ai.roast.excellent", "今日食得好靚仔！繼續保持！");
  }
  return t(lang, "ai.roast.good", "表現唔錯，再留意下脂肪同鈉就完美啦！");
}

import type { MealLog } from "./types";

export function getMealAiComment(log: MealLog): string {
  if (log.calories >= 700) {
    return "熱量偏高（已含湯底/用油估算），建議減少油炸同澱粉，下一餐增加蔬菜比例。";
  }
  if (log.calories <= 500 && log.protein >= 20) {
    return "表現優良，蛋白質充足，可維持而家嘅飲食節奏。";
  }
  if (log.protein < 15) {
    return "蛋白質偏低，建議加雞胸、魚或蛋補充。";
  }
  if (log.calories < 250) {
    return "熱量偏低，注意唔好過度節食影響訓練恢復。";
  }
  return "整體尚可，建議控制醬料同飲品糖分。";
}

export function generateCoachReport(logs: MealLog[]): string {
  if (logs.length === 0) {
    return "暫時未有學員飲食打卡。等學員記低第一餐，AI 先可以出整合報告。";
  }

  const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const avgCalories = Math.round(totalCalories / logs.length);
  const highRisk = logs.filter((log) => log.calories > 750);
  const goodLogs = logs.filter((log) => log.calories < 400);

  const riskLines =
    highRisk.length > 0
      ? highRisk
          .slice(0, 3)
          .map(
            (log) =>
              `- ${log.description}（${log.calories} kcal）熱量偏高，建議教練跟進鈉同油脂。`
          )
          .join("\n")
      : "- 今日未見超高熱量地雷餐，整體可控。";

  const goodLines =
    goodLogs.length > 0
      ? goodLogs
          .slice(0, 3)
          .map(
            (log) =>
              `- ${log.description}（蛋白 ${log.protein}g）表現唔錯，可以繼續鼓勵。`
          )
          .join("\n")
      : "- 暫時未見明顯優秀餐單，建議提醒學員增加優質蛋白。";

  return `🤖 【AI 學員整合報告】

📊 數據概覽：
- 打卡總數：${logs.length} 餐
- 平均熱量：${avgCalories} kcal / 餐

🚨 高風險飲食：
${riskLines}

✅ 表現良好：
${goodLines}

💡 教練建議：
今個星期優先處理高熱量打卡學員，配合飲水提醒同蛋白質目標，進度會穩定好多。`;
}

export function buildLogSummary(log: {
  mealType: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  date: string;
}): string {
  return `【學員飲食記錄】
日期：${new Date(log.date).toLocaleString("zh-HK")}
餐別：${log.mealType}
食物：${log.description}
熱量：${log.calories} kcal | 蛋白質：${log.protein}g | 碳水：${log.carbs}g | 脂肪：${log.fats}g`;
}
