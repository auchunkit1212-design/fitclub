import { estimateMacros } from "@/lib/ai-mock";
import type { FoodSearchItem } from "@/lib/types";

export class FoodSearchError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "FoodSearchError";
    this.statusCode = statusCode;
  }
}

type MacroSet = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  weightG: number;
};

/** 關鍵字越具體越靠前匹配 */
const FOOD_RULES: { test: RegExp; macros: MacroSet }[] = [
  {
    test: /latte|拿鐵|flat white/i,
    macros: { calories: 190, protein: 9, carbs: 18, fats: 8, weightG: 350 },
  },
  {
    test: /cappuccino|卡布/i,
    macros: { calories: 120, protein: 6, carbs: 12, fats: 6, weightG: 300 },
  },
  {
    test: /espresso|意式|浓缩/i,
    macros: { calories: 5, protein: 0, carbs: 1, fats: 0, weightG: 30 },
  },
  {
    test: /coffee|咖啡/i,
    macros: { calories: 15, protein: 1, carbs: 2, fats: 0, weightG: 240 },
  },
  {
    test: /叉燒飯|char siu rice/i,
    macros: { calories: 820, protein: 32, carbs: 95, fats: 32, weightG: 450 },
  },
  {
    test: /茶走|奶茶|檸茶|milky tea/i,
    macros: { calories: 310, protein: 4, carbs: 48, fats: 12, weightG: 350 },
  },
  {
    test: /乾炒牛河|炒牛河/i,
    macros: { calories: 950, protein: 28, carbs: 88, fats: 48, weightG: 420 },
  },
  {
    test: /拉麵|ramen|叉燒.*麵|牛肉.*麵/i,
    macros: { calories: 780, protein: 34, carbs: 82, fats: 30, weightG: 480 },
  },
  {
    test: /雞胸|chicken breast/i,
    macros: { calories: 220, protein: 42, carbs: 0, fats: 5, weightG: 150 },
  },
  {
    test: /三文治|sandwich|多士|toast/i,
    macros: { calories: 420, protein: 16, carbs: 44, fats: 20, weightG: 180 },
  },
  {
    test: /沙拉|salad/i,
    macros: { calories: 280, protein: 12, carbs: 18, fats: 18, weightG: 250 },
  },
  {
    test: /壽司|sushi/i,
    macros: { calories: 380, protein: 18, carbs: 58, fats: 8, weightG: 220 },
  },
  {
    test: /漢堡|burger/i,
    macros: { calories: 650, protein: 28, carbs: 52, fats: 36, weightG: 280 },
  },
  {
    test: /pizza|薄餅/i,
    macros: { calories: 720, protein: 26, carbs: 78, fats: 32, weightG: 320 },
  },
  {
    test: /意粉|pasta|通粉/i,
    macros: { calories: 580, protein: 24, carbs: 68, fats: 22, weightG: 350 },
  },
  {
    test: /蛋|egg/i,
    macros: { calories: 155, protein: 13, carbs: 1, fats: 11, weightG: 100 },
  },
  {
    test: /飯|rice(?!.*cake)/i,
    macros: { calories: 520, protein: 14, carbs: 78, fats: 14, weightG: 380 },
  },
  {
    test: /麵|noodle/i,
    macros: { calories: 480, protein: 18, carbs: 68, fats: 14, weightG: 400 },
  },
  {
    test: /湯|soup/i,
    macros: { calories: 180, protein: 12, carbs: 14, fats: 8, weightG: 350 },
  },
];

function hashQuery(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

function estimateFromRules(query: string): MacroSet {
  const q = query.trim();
  const lower = q.toLowerCase();

  for (const rule of FOOD_RULES) {
    if (rule.test.test(q) || rule.test.test(lower)) {
      return rule.macros;
    }
  }

  const base = estimateMacros(q, "中拳", "中掌", "有");
  const h = hashQuery(lower);
  const jitter = (h % 41) - 20;

  return {
    calories: Math.max(80, base.calories + jitter),
    protein: Math.max(0, base.protein + ((h >> 3) % 7) - 3),
    carbs: Math.max(0, base.carbs + ((h >> 5) % 11) - 5),
    fats: Math.max(0, base.fats + ((h >> 7) % 5) - 2),
    weightG: 280 + (h % 120),
  };
}

function toSearchItem(query: string, macros: MacroSet): FoodSearchItem {
  return {
    id: `local-${Date.now()}-${query.slice(0, 12)}`,
    name: query.trim(),
    brand: "",
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fats: macros.fats,
    weightG: macros.weightG,
    servingLabel: `約 ${macros.weightG}g · 標準一人份`,
    source: "local",
  };
}

/** 本地智能估算（無需外部 API，即時可用） */
export async function searchFoodLocally(query: string): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];
  const macros = estimateFromRules(q);
  return [toSearchItem(q, macros)];
}
