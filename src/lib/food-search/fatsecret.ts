import type { FoodSearchItem } from "@/lib/types";
import { FoodSearchError, toFoodSearchItem } from "@/lib/food-search/shared";

const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_URL = "https://platform.fatsecret.com/rest/server.api";

let tokenCache: { token: string; expiresAt: number } | null = null;

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

async function fetchFoodDetail(foodId: string): Promise<FoodSearchItem | null> {
  const data = await fatSecretCall<{
    food?: {
      food_name?: string;
      brand_name?: string;
      servings?: { serving?: FatSecretServing | FatSecretServing[] };
    };
  }>("food.get.v4", { food_id: foodId });

  const food = data.food;
  if (!food) return null;

  const servings = asArray(food.servings?.serving);
  const serving =
    servings.find((s) => s.is_default === "1") ??
    servings.find((s) => s.metric_serving_unit === "g") ??
    servings[0];

  if (!serving) return null;

  const calories = Number(serving.calories);
  const protein = Number(serving.protein);
  const carbs = Number(serving.carbohydrate);
  const fat = Number(serving.fat);
  if (!Number.isFinite(calories) || calories <= 0) return null;

  let weightG = Number(serving.metric_serving_amount);
  if (!Number.isFinite(weightG) || weightG <= 0) weightG = 100;

  return toFoodSearchItem(
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
}

/** FatSecret foods.search 主力查詢 */
export async function searchFoodWithFatSecret(query: string): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];

  const searchData = await fatSecretCall<{
    foods_search?: {
      results?: { food?: FatSecretSearchFood | FatSecretSearchFood[] };
    };
  }>("foods.search", {
    search_expression: q,
    max_results: "5",
    page_number: "0",
  });

  const foods = asArray(searchData.foods_search?.results?.food);
  if (foods.length === 0) return [];

  const items: FoodSearchItem[] = [];
  for (const food of foods.slice(0, 5)) {
    try {
      const detail = await fetchFoodDetail(food.food_id);
      if (detail) {
        if (food.brand_name) {
          detail.brand = food.brand_name;
          detail.name = food.food_name;
        }
        items.push(detail);
      }
    } catch (err) {
      console.warn("[fatsecret] food detail skipped", food.food_id, err);
    }
  }

  return items;
}
