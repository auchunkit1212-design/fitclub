import type { FoodSearchItem } from "@/lib/types";
import { toFoodSearchItem } from "@/lib/food-search/shared";
import hkTwFoodDatabase from "@/data/hk_tw_food_local.json";
import hk711FoodDatabase from "@/data/hk_711_food.json";

export type LocalFoodRow = {
  food_name: string;
  aliases?: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight_g: number;
  region?: "HK" | "TW";
  store?: string;
  brand_line?: string;
  category?: string;
  sodium_mg?: number;
  sugar_g?: number;
};

type ScoredRow = { row: LocalFoodRow; score: number; source: "hk_tw" | "hk_711" };

const HK_TW_FOODS = hkTwFoodDatabase as LocalFoodRow[];
const HK_711_FOODS = hk711FoodDatabase as LocalFoodRow[];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function matchesQuery(name: string, query: string): boolean {
  const n = normalize(name);
  const q = normalize(query);
  if (!n || !q || q.length < 1) return false;
  return n.includes(q);
}

function rowSearchTexts(row: LocalFoodRow): string[] {
  return [row.food_name, ...(row.aliases ?? [])];
}

function matchRank(name: string, query: string): number {
  const n = normalize(name);
  const q = normalize(query);
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 80;
  return 0;
}

function rowToFoodSearchItem(
  row: LocalFoodRow,
  source: "hk_tw" | "hk_711"
): FoodSearchItem {
  const item = toFoodSearchItem(
    {
      food_name: row.food_name,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      weight_g: row.weight_g > 0 ? row.weight_g : 1,
      sugar: row.sugar_g,
      sodium_mg: row.sodium_mg,
    },
    source
  );

  if (source === "hk_711") {
    const parts = ["7-11", row.brand_line, row.category].filter(Boolean);
    item.brand = parts.join(" · ");
    item.servingLabel = "1 份（7-11 標準份量）";
    item.id = `hk_711-${row.food_name}-${row.brand_line ?? ""}`;
  } else if (row.region === "TW") {
    item.brand = "台灣";
    item.id = `hk_tw-${row.food_name}`;
  } else if (row.region === "HK") {
    item.brand = "香港";
    item.id = `hk_tw-${row.food_name}`;
  } else {
    item.id = `hk_tw-${row.food_name}`;
  }

  if (row.sodium_mg != null) item.sodiumMg = row.sodium_mg;
  if (row.sugar_g != null) item.sugarG = row.sugar_g;

  return item;
}

function searchRows(
  rows: LocalFoodRow[],
  source: ScoredRow["source"],
  query: string
): ScoredRow[] {
  const q = query.trim();
  if (!q) return [];

  return rows.flatMap((row) => {
    const texts = rowSearchTexts(row);
    const matched = texts.some((text) => matchesQuery(text, q));
    if (!matched) return [];
    const best = Math.max(...texts.map((text) => matchRank(text, q)));
    return [{ row, score: best, source }];
  });
}

/**
 * Search HK/TW local JSON + 7-11 nutrition DB — substring match on name + aliases.
 */
export function searchLocalFoodDatabase(
  query: string,
  limit = 12
): FoodSearchItem[] {
  const q = query.trim();
  if (!q) return [];

  const scored: ScoredRow[] = [
    ...searchRows(HK_TW_FOODS, "hk_tw", q),
    ...searchRows(HK_711_FOODS, "hk_711", q),
  ];

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.row.food_name.localeCompare(b.row.food_name, "zh-Hant")
  );

  const seen = new Set<string>();
  const items: FoodSearchItem[] = [];

  for (const { row, source } of scored) {
    const key = `${source}:${row.food_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(rowToFoodSearchItem(row, source));
    if (items.length >= limit) break;
  }

  return items;
}

export function getLocalFoodDatabaseStats() {
  const hkTwHk = HK_TW_FOODS.filter((r) => r.region === "HK").length;
  const hkTwTw = HK_TW_FOODS.filter((r) => r.region === "TW").length;
  return {
    total: HK_TW_FOODS.length + HK_711_FOODS.length,
    hkTw: HK_TW_FOODS.length,
    hkTwHk,
    hkTwTw,
    hk711: HK_711_FOODS.length,
  };
}
