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

function matchesQuery(name: string, query: string): boolean {
  return normalize(name).includes(normalize(query));
}

/** @deprecated 茶餐廳 JSON 保底；主搜尋已改 OpenRouter */
export function searchHkFoodDatabase(query: string): FoodSearchItem[] {
  const q = query.trim();
  if (!q) return [];

  const hits = HK_FOODS.filter((row) =>
    [row.food_name, ...(row.aliases ?? [])].some((name) => matchesQuery(name, q))
  );

  return hits.slice(0, 5).map((row) =>
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
