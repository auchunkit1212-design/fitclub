import type { FoodSearchItem } from "@/lib/types";
import { FoodSearchError, toFoodSearchItem } from "@/lib/food-search/shared";
import hkFoodDatabase from "@/data/hk_food_database.json";

type HkFoodRow = {
  food_name: string;
  aliases?: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight_g: number;
};

const HK_FOODS = hkFoodDatabase as HkFoodRow[];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** 查詢字是否為目標名的子序列（支援「雞胸」→「香煎雞胸肉」） */
function isSubsequence(query: string, target: string): boolean {
  if (query.length < 2) return false;
  let i = 0;
  for (const ch of target) {
    if (ch === query[i]) i += 1;
    if (i === query.length) return true;
  }
  return i === query.length;
}

function matchScore(name: string, query: string): number {
  const n = normalize(name);
  const q = normalize(query);
  if (!n || !q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 95;
  if (n.includes(q)) return 90;
  if (q.includes(n) && n.length >= 2) return 75;
  if (isSubsequence(q, n)) return 60;
  // English / mixed token match (e.g. "latte" → "Latte Coffee")
  const qTokens = q.split(/[\s,·/]+/).filter(Boolean);
  const nTokens = n.split(/[\s,·/]+/).filter(Boolean);
  if (
    qTokens.length > 0 &&
    qTokens.every((qt) =>
      nTokens.some((nt) => nt.includes(qt) || qt.includes(nt))
    )
  ) {
    return 85;
  }
  return 0;
}

/** 地道茶餐廳 JSON 保底查詢 */
export function searchHkFoodDatabase(query: string): FoodSearchItem[] {
  const q = normalize(query);
  if (!q) return [];

  const scored = HK_FOODS.flatMap((row) => {
    const names = [row.food_name, ...(row.aliases ?? [])];
    const best = Math.max(...names.map((name) => matchScore(name, q)));
    return best > 0 ? [{ row, score: best }] : [];
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map(({ row }) =>
    toFoodSearchItem(
      {
        food_name: row.food_name,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
        weight_g: row.weight_g,
      },
      "hk"
    )
  );
}

export function searchHkFoodDatabaseOrThrow(query: string): FoodSearchItem[] {
  const items = searchHkFoodDatabase(query);
  if (items.length === 0) {
    throw new FoodSearchError("搵唔到相關食物，請換個關鍵字再試", 404);
  }
  return items;
}
