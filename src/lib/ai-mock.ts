export interface MacroEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

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
5. 輸出：calories, protein_g, carbs_g, fats_g 整數，並附一句隱形熱量說明。`;

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

export function estimateMacros(
  description: string,
  carbsPortion: string,
  proteinPortion: string,
  hasVeggies: string
): MacroEstimate {
  const desc = description;

  let calories = 450;
  let protein = 18;
  let carbs = 55;
  let fats = 16;

  if (matchesAny(desc, HIGH_CAL_KEYWORDS)) {
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

  if (carbsPortion === PORTION_NONE) {
    carbs = 0;
    calories -= 180;
    fats -= 4;
  } else {
    if (carbsPortion === "大拳") calories += 80;
    if (carbsPortion === "細拳") calories -= 60;
  }

  if (proteinPortion === PORTION_NONE) {
    protein = 0;
    calories -= 120;
    fats -= 6;
  } else {
    if (proteinPortion === "大掌") protein += 18;
    if (proteinPortion === "細掌") protein -= 10;
  }

  if (hasVeggies === PORTION_NONE) {
    // no veggie adjustment
  } else if (hasVeggies === "有") {
    calories -= 20;
    carbs -= 5;
  }

  const base: MacroEstimate = {
    calories: Math.max(0, Math.round(calories)),
    protein: Math.max(0, Math.round(protein)),
    carbs: Math.max(0, Math.round(carbs)),
    fats: Math.max(0, Math.round(fats)),
  };

  return applyHiddenCalorieFloor(desc, base);
}

export function generateRoast(
  todayCalories: number,
  targetCalories: number,
  todayProtein: number,
  targetProtein: number
): string {
  const calRatio = todayCalories / targetCalories;
  const proRatio = todayProtein / targetProtein;

  if (todayCalories === 0) {
    return "仲未食嘢？唔好餓壞個胃呀，記得記低你食咗咩！";
  }
  if (calRatio > 1.25) {
    return "食咁多乾炒牛河唔怪之得減唔到肥啦！聽日試下少油少鹽啦！";
  }
  if (calRatio > 1.05) {
    return "今日有啲放縱喎，茶餐廳陷阱要小心，唔好再加杯凍奶茶！";
  }
  if (calRatio < 0.6) {
    return "食咁少？你係咪想變營養不良？記得食夠蛋白質呀！";
  }
  if (proRatio < 0.7) {
    return "蛋白質唔夠喎，加啲雞胸或者蛋啦，唔好淨係食碳水！";
  }
  if (calRatio >= 0.85 && calRatio <= 1.05 && proRatio >= 0.9) {
    return "今日食得好靚仔！繼續保持，教練見到都笑！";
  }
  return "表現唔錯，再留意下脂肪同鈉就完美啦！";
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

export function getMealStatus(log: MealLog): "優良" | "危險" {
  if (log.calories >= 700) return "危險";
  if (log.calories <= 500 && log.protein >= 20) return "優良";
  return "危險";
}

export function generateCoachReport(logs: MealLog[]): string {
  if (logs.length === 0) {
    return "暫時未有學員飲食打卡。等學員記低第一餐，AI 先可以出整合報告。";
  }

  const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const avgCalories = Math.round(totalCalories / logs.length);
  const highRisk = logs.filter((log) => log.calories >= 700);
  const goodLogs = logs.filter((log) => log.calories <= 500 && log.protein >= 20);

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
