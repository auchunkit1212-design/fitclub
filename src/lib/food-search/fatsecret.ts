import type { FoodSearchItem } from "@/lib/types";
import { FoodSearchError, toFoodSearchItem } from "@/lib/food-search/shared";

const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_URL = "https://platform.fatsecret.com/rest/server.api";

let tokenCache: { token: string; expiresAt: number } | null = null;

export function isFatSecretConfigured(): boolean {
  return Boolean(process.env.FATSECRET_CLIENT_ID && process.env.FATSECRET_CLIENT_SECRET);
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function getFatSecretAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new FoodSearchError(
      "FatSecret 尚未設定，請聯絡管理員加入 FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET",
      503
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "basic",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[fatsecret] token error", res.status, detail);
    throw new FoodSearchError("FatSecret 授權失敗", 502);
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new FoodSearchError("FatSecret 未取得 access token", 502);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function fatSecretCall<T>(method: string, params: Record<string, string>): Promise<T> {
  const token = await getFatSecretAccessToken();
  const payload = new URLSearchParams({
    method,
    format: "json",
    ...params,
  });
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[fatsecret] API error", method, res.status, detail);
    throw new FoodSearchError("FatSecret 查詢失敗", 502);
  }
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (data && typeof data === "object" && "error" in data && data.error) {
    console.error("[fatsecret] API logical error", method, data.error);
    throw new FoodSearchError(
      `FatSecret 查詢失敗${data.error.message ? `: ${data.error.message}` : ""}`,
      502
    );
  }
  return data as T;
}

type FatSecretSearchFood = {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_type?: string;
  food_description?: string;
};

type FatSecretServing = {
  serving_description?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  is_default?: string;
};

/** FatSecret 回傳格式：新版 `foods.food` 或舊版 `foods_search.results.food` */
function extractSearchFoods(data: {
  foods?: { food?: FatSecretSearchFood | FatSecretSearchFood[] };
  foods_search?: { results?: { food?: FatSecretSearchFood | FatSecretSearchFood[] } };
}): FatSecretSearchFood[] {
  return asArray(data.foods?.food ?? data.foods_search?.results?.food);
}

/** Generic 食物通常比品牌更適合做營養參考 */
function sortSearchFoods(foods: FatSecretSearchFood[]): FatSecretSearchFood[] {
  return [...foods].sort((a, b) => {
    const aGeneric = a.food_type === "Generic" ? 0 : 1;
    const bGeneric = b.food_type === "Generic" ? 0 : 1;
    return aGeneric - bGeneric;
  });
}

/** 優先選 100g 標準參考份量，其次 API 標記的 default serving */
function pickBestServing(servings: FatSecretServing[]): FatSecretServing | null {
  if (servings.length === 0) return null;

  const flagged = servings.find((s) => s.is_default === "1");
  if (flagged) return flagged;

  const hundredGram = servings.find((s) => {
    if (s.metric_serving_unit !== "g") return false;
    const amount = Number(s.metric_serving_amount);
    return Number.isFinite(amount) && Math.abs(amount - 100) < 2;
  });
  if (hundredGram) return hundredGram;

  const anyGram = servings.find((s) => s.metric_serving_unit === "g");
  if (anyGram) return anyGram;

  return servings[0];
}

/** 從搜尋摘要解析（food.get 失敗時的保底；支援 Per 100g / Per 1 slice / Per 1 cake） */
function parseDescriptionMacros(description: string): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight_g: number;
  serving_label: string;
} | null {
  const calories = Number(description.match(/Calories:\s*([\d.]+)/i)?.[1]);
  const fat = Number(description.match(/Fat:\s*([\d.]+)/i)?.[1]);
  const carbs = Number(description.match(/Carbs:\s*([\d.]+)/i)?.[1]);
  const protein = Number(description.match(/Protein:\s*([\d.]+)/i)?.[1]);
  const weight_g = Number(description.match(/Per\s+([\d.]+)\s*g/i)?.[1]);
  const perLabel = description.match(/Per\s+([^-]+?)\s*-\s*Calories/i)?.[1]?.trim();

  if (!Number.isFinite(calories) || calories <= 0) return null;

  const weight = Number.isFinite(weight_g) ? Math.round(weight_g) : 0;
  const serving_label =
    perLabel && perLabel.length > 0
      ? perLabel
      : weight > 0
        ? `${weight}g`
        : "standard serving";

  return {
    calories: Math.round(calories),
    protein: Math.round(Number.isFinite(protein) ? protein : 0),
    carbs: Math.round(Number.isFinite(carbs) ? carbs : 0),
    fat: Math.round(Number.isFinite(fat) ? fat : 0),
    weight_g: weight,
    serving_label,
  };
}

async function fetchFoodDetail(foodId: string): Promise<FoodSearchItem | null> {
  const data = await fatSecretCall<{
    food?: {
      food_name?: string;
      brand_name?: string;
      servings?: { serving?: FatSecretServing | FatSecretServing[] };
    };
  }>("food.get.v4", {
    food_id: foodId,
    flag_default_serving: "true",
  });

  const food = data.food;
  if (!food) return null;

  const servings = asArray(food.servings?.serving);
  const serving = pickBestServing(servings);
  if (!serving) return null;

  const calories = Number(serving.calories);
  const protein = Number(serving.protein);
  const carbs = Number(serving.carbohydrate);
  const fat = Number(serving.fat);
  if (!Number.isFinite(calories) || calories <= 0) return null;

  let weightG = Number(serving.metric_serving_amount);
  if (!Number.isFinite(weightG) || weightG <= 0) weightG = 100;

  const item = toFoodSearchItem(
    {
      food_name: food.food_name ?? "Unknown food",
      calories: Math.round(calories),
      protein: Math.round(protein || 0),
      carbs: Math.round(carbs || 0),
      fat: Math.round(fat || 0),
      weight_g: Math.round(weightG),
    },
    "fatsecret"
  );
  item.servingLabel = serving.serving_description?.trim() || item.servingLabel;
  if (food.brand_name) item.brand = food.brand_name;
  return item;
}

async function searchHitToItem(food: FatSecretSearchFood): Promise<FoodSearchItem | null> {
  try {
    const detail = await fetchFoodDetail(food.food_id);
    if (detail) {
      detail.name = food.food_name;
      if (food.brand_name) detail.brand = food.brand_name;
      return detail;
    }
  } catch (err) {
    console.warn("[fatsecret] food.get skipped", food.food_id, err);
  }

  if (food.food_description) {
    const macros = parseDescriptionMacros(food.food_description);
    if (macros) {
      const item = toFoodSearchItem(
        {
          food_name: food.food_name,
          calories: macros.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          weight_g: macros.weight_g,
        },
        "fatsecret"
      );
      item.servingLabel = macros.serving_label;
      if (food.brand_name) item.brand = food.brand_name;
      return item;
    }
  }

  return null;
}

/** 搜尋關鍵字變體（loaf-cake → loaf cake） */
export function searchQueryVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const variants = [trimmed];
  const spaced = trimmed.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (spaced && spaced !== trimmed) variants.push(spaced);
  return Array.from(new Set(variants));
}

async function searchFoodWithFatSecretOnce(query: string): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];

  const searchData = await fatSecretCall<{
    foods?: { food?: FatSecretSearchFood | FatSecretSearchFood[] };
    foods_search?: { results?: { food?: FatSecretSearchFood | FatSecretSearchFood[] } };
  }>("foods.search", {
    search_expression: q,
    max_results: "5",
    page_number: "0",
  });

  const foods = sortSearchFoods(extractSearchFoods(searchData));
  if (foods.length === 0) return [];

  const items: FoodSearchItem[] = [];
  for (const food of foods.slice(0, 5)) {
    const item = await searchHitToItem(food);
    if (item) items.push(item);
  }

  return items;
}

/** FatSecret foods.search 主力查詢（以 food.get.v4 取得精確份量） */
export async function searchFoodWithFatSecret(query: string): Promise<FoodSearchItem[]> {
  for (const variant of searchQueryVariants(query)) {
    const items = await searchFoodWithFatSecretOnce(variant);
    if (items.length > 0) return items;
  }
  return [];
}
