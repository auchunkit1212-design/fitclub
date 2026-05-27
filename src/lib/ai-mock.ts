export interface MacroEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const HIGH_CAL_KEYWORDS = ["炒飯", "牛河", "乾炒", "焗飯", "公仔麵", "即食麵", "炸"];
const LOW_RICE_KEYWORDS = ["少飯", "走飯", "少油"];

export function estimateMacros(
  description: string,
  carbsPortion: string,
  proteinPortion: string,
  hasVeggies: string
): MacroEstimate {
  const text = description.toLowerCase();
  const desc = description;

  let calories = 450;
  let protein = 18;
  let carbs = 55;
  let fats = 16;

  if (HIGH_CAL_KEYWORDS.some((k) => desc.includes(k))) {
    calories = 820;
    protein = 28;
    carbs = 78;
    fats = 38;
  } else if (desc.includes("奶茶") || desc.includes("檸茶")) {
    calories = 280;
    protein = 4;
    carbs = 42;
    fats = 10;
  } else if (desc.includes("三文治") || desc.includes("多士")) {
    calories = 380;
    protein = 14;
    carbs = 40;
    fats = 18;
  } else if (desc.includes("通粉") || desc.includes("意粉")) {
    calories = 520;
    protein = 22;
    carbs = 62;
    fats = 18;
  }

  if (LOW_RICE_KEYWORDS.some((k) => desc.includes(k))) {
    calories -= 120;
    carbs -= 28;
  }

  if (carbsPortion === "大拳") calories += 80;
  if (carbsPortion === "細拳") calories -= 60;
  if (proteinPortion === "大掌") protein += 18;
  if (proteinPortion === "細掌") protein -= 10;
  if (hasVeggies === "有") {
    calories -= 20;
    carbs -= 5;
  }

  return {
    calories: Math.max(80, Math.round(calories)),
    protein: Math.max(2, Math.round(protein)),
    carbs: Math.max(5, Math.round(carbs)),
    fats: Math.max(2, Math.round(fats)),
  };
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
