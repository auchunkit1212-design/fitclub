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

/** 地道茶餐廳 JSON 保底查詢 */
export function searchHkFoodDatabase(query: string): FoodSearchItem[] {
  const q = normalize(query);
  if (!q) return [];

  const matches = HK_FOODS.filter((row) => {
    const names = [row.food_name, ...(row.aliases ?? [])].map(normalize);
    return names.some((name) => name.includes(q) || q.includes(name));
  });

  return matches.slice(0, 5).map((row) =>
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
