import type { FoodSearchItem } from "@/lib/types";

const MOCK_FOODS: FoodSearchItem[] = [
  {
    id: "mock-1",
    name: "叉燒飯",
    brand: "茶餐廳",
    calories: 720,
    protein: 28,
    carbs: 95,
    fats: 22,
    servingLabel: "1 碟",
    source: "mock",
  },
  {
    id: "mock-2",
    name: "雞胸沙律",
    brand: "便利店",
    calories: 320,
    protein: 35,
    carbs: 18,
    fats: 12,
    servingLabel: "1 盒",
    source: "mock",
  },
  {
    id: "mock-3",
    name: "全脂牛奶",
    brand: "維他",
    calories: 130,
    protein: 7,
    carbs: 10,
    fats: 7,
    servingLabel: "250ml",
    source: "mock",
  },
  {
    id: "mock-4",
    name: "蛋白棒",
    brand: "Quest",
    calories: 200,
    protein: 20,
    carbs: 22,
    fats: 8,
    servingLabel: "1 條",
    source: "mock",
  },
];

export async function searchFoodDatabase(
  query: string
): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];

  const appId = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;

  if (!appId || !appKey) {
    return MOCK_FOODS.filter(
      (f) =>
        f.name.includes(q) ||
        f.brand.includes(q) ||
        q.length <= 2
    ).slice(0, 12);
  }

  const url = new URL("https://api.edamam.com/api/food-database/v2/parser");
  url.searchParams.set("ingr", q);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("lang", "zh");

  const res = await fetch(url.toString());
  if (!res.ok) {
    return MOCK_FOODS.slice(0, 6);
  }

  const data = (await res.json()) as {
    hints?: {
      food?: {
        foodId: string;
        label: string;
        brand?: string;
        nutrients?: {
          ENERC_KCAL?: number;
          PROCNT?: number;
          CHOCDF?: number;
          FAT?: number;
        };
        servingSizes?: { label: string }[];
      };
    }[];
  };

  const items: FoodSearchItem[] = [];
  for (const hint of (data.hints ?? []).slice(0, 15)) {
    const food = hint.food;
    if (!food) continue;
    const n = food.nutrients ?? {};
    const calories = Math.round(n.ENERC_KCAL ?? 0);
    if (calories <= 0) continue;
    items.push({
      id: food.foodId,
      name: food.label,
      brand: food.brand ?? "",
      calories,
      protein: Math.round(n.PROCNT ?? 0),
      carbs: Math.round(n.CHOCDF ?? 0),
      fats: Math.round(n.FAT ?? 0),
      servingLabel: food.servingSizes?.[0]?.label ?? "100g",
      source: "edamam",
    });
  }
  return items;
}
