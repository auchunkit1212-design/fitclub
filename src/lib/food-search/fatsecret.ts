import type { FoodSearchItem } from "@/lib/types";
import { FoodSearchError, toFoodSearchItem } from "@/lib/food-search/shared";

const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_URL = "https://platform.fatsecret.com/rest/server.api";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export function isFatSecretConfigured(): boolean {
  const id = process.env.FATSECRET_CLIENT_ID?.trim();
  const secret = process.env.FATSECRET_CLIENT_SECRET?.trim();
  return Boolean(id && secret);
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.FATSECRET_CLIENT_ID?.trim();
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new FoodSearchError(
      "FatSecret 尚未設定：請在環境變數加入 FATSECRET_CLIENT_ID 及 FATSECRET_CLIENT_SECRET",
      503
    );
  }
  return { clientId, clientSecret };
}

function clearTokenCache(): void {
  tokenCache = null;
}

/**
 * OAuth 2.0 Client Credentials（FatSecret 官方流程）
 * POST https://oauth.fatsecret.com/connect/token
 * Authorization: Basic base64(client_id:client_secret)
 * Body: grant_type=client_credentials&scope=basic
 */
async function fetchAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getCredentials();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "basic",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error("[fatsecret] OAuth token failed", res.status, raw);
    let hint = "";
    if (res.status === 401 || raw.includes("invalid_client")) {
      hint = " 請檢查 FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET 是否正確。";
    }
    if (raw.includes("invalid_scope")) {
      hint = " API scope 無效，請確認 FatSecret 帳戶已啟用 basic API。";
    }
    throw new FoodSearchError(`FatSecret OAuth 授權失敗 (${res.status})${hint}`, 502);
  }

  let data: { access_token?: string; expires_in?: number };
  try {
    data = JSON.parse(raw) as { access_token?: string; expires_in?: number };
  } catch {
    throw new FoodSearchError("FatSecret OAuth 回應不是有效 JSON", 502);
  }

  if (!data.access_token) {
    throw new FoodSearchError("FatSecret OAuth 未取得 access_token", 502);
  }

  const expiresIn = Number(data.expires_in);
  const ttlMs =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? expiresIn * 1000
      : 24 * 60 * 60 * 1000;

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + ttlMs,
  };

  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }
  return fetchAccessToken();
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

type FatSecretApiError = { code?: number; message?: string };

async function fatSecretCall<T>(
  method: string,
  params: Record<string, string>,
  retryOnUnauthorized = true
): Promise<T> {
  const token = await getAccessToken();
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
      Accept: "application/json",
    },
    body: payload.toString(),
  });

  const raw = await res.text();

  if (res.status === 401 && retryOnUnauthorized) {
    clearTokenCache();
    return fatSecretCall<T>(method, params, false);
  }

  if (!res.ok) {
    console.error("[fatsecret] API HTTP error", method, res.status, raw.slice(0, 500));
    throw new FoodSearchError(`FatSecret API HTTP ${res.status}`, 502);
  }

  let data: T & { error?: FatSecretApiError };
  try {
    data = JSON.parse(raw) as T & { error?: FatSecretApiError };
  } catch {
    throw new FoodSearchError("FatSecret API 回應不是有效 JSON", 502);
  }

  if (data?.error?.message) {
    console.error("[fatsecret] API error", method, data.error);
    throw new FoodSearchError(`FatSecret: ${data.error.message}`, 502);
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

/** 解析 foods.search 各版本回傳格式 */
function extractSearchFoods(data: Record<string, unknown>): FatSecretSearchFood[] {
  const foods = data.foods as { food?: FatSecretSearchFood | FatSecretSearchFood[] } | undefined;
  if (foods?.food) return asArray(foods.food);

  const foodsSearch = data.foods_search as
    | { results?: { food?: FatSecretSearchFood | FatSecretSearchFood[] } }
    | undefined;
  if (foodsSearch?.results?.food) return asArray(foodsSearch.results.food);

  return [];
}

function sortSearchFoods(foods: FatSecretSearchFood[]): FatSecretSearchFood[] {
  return [...foods].sort((a, b) => {
    const aGeneric = a.food_type === "Generic" ? 0 : 1;
    const bGeneric = b.food_type === "Generic" ? 0 : 1;
    return aGeneric - bGeneric;
  });
}

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

  const weight = Number.isFinite(weight_g) && weight_g > 0 ? Math.round(weight_g) : 0;
  const serving_label =
    perLabel && perLabel.length > 0 ? perLabel : weight > 0 ? `${weight}g` : "1 serving";

  return {
    calories: Math.round(calories),
    protein: Math.round(Number.isFinite(protein) ? protein : 0),
    carbs: Math.round(Number.isFinite(carbs) ? carbs : 0),
    fat: Math.round(Number.isFinite(fat) ? fat : 0),
    weight_g: weight > 0 ? weight : 100,
    serving_label,
  };
}

function pickBestServing(servings: FatSecretServing[]): FatSecretServing | null {
  if (servings.length === 0) return null;
  return (
    servings.find((s) => s.is_default === "1") ??
    servings.find((s) => {
      if (s.metric_serving_unit !== "g") return false;
      const amount = Number(s.metric_serving_amount);
      return Number.isFinite(amount) && Math.abs(amount - 100) < 2;
    }) ??
    servings.find((s) => s.metric_serving_unit === "g") ??
    servings[0]
  );
}

function searchHitToItemFromDescription(food: FatSecretSearchFood): FoodSearchItem | null {
  if (!food.food_description) return null;
  const macros = parseDescriptionMacros(food.food_description);
  if (!macros) return null;

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
  item.id = `fatsecret-${food.food_id}`;
  item.servingLabel = macros.serving_label;
  if (food.brand_name) item.brand = food.brand_name;
  return item;
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
  item.id = `fatsecret-${foodId}`;
  item.servingLabel = serving.serving_description?.trim() || item.servingLabel;
  if (food.brand_name) item.brand = food.brand_name;
  return item;
}

async function searchHitToItem(food: FatSecretSearchFood): Promise<FoodSearchItem | null> {
  const fromDesc = searchHitToItemFromDescription(food);
  if (fromDesc) return fromDesc;

  try {
    const detail = await fetchFoodDetail(food.food_id);
    if (detail) {
      detail.name = food.food_name;
      if (food.brand_name) detail.brand = food.brand_name;
      return detail;
    }
  } catch (err) {
    console.warn("[fatsecret] food.get.v4 skipped", food.food_id, err);
  }

  return null;
}

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

  const searchData = await fatSecretCall<Record<string, unknown>>("foods.search", {
    search_expression: q,
    max_results: "5",
    page_number: "0",
  });

  const foods = sortSearchFoods(extractSearchFoods(searchData));
  if (foods.length === 0) {
    console.warn("[fatsecret] foods.search returned 0 foods for:", q);
    return [];
  }

  const settled = await Promise.all(foods.slice(0, 5).map((food) => searchHitToItem(food)));
  const items = settled.filter((item): item is FoodSearchItem => item !== null);

  if (items.length === 0) {
    console.warn(
      "[fatsecret] could not map any search hits to items for:",
      q,
      "raw count:",
      foods.length
    );
  }

  return items;
}

/** FatSecret foods.search（OAuth 2.0 Bearer token） */
export async function searchFoodWithFatSecret(query: string): Promise<FoodSearchItem[]> {
  for (const variant of searchQueryVariants(query)) {
    const items = await searchFoodWithFatSecretOnce(variant);
    if (items.length > 0) return items;
  }
  return [];
}

export type FatSecretDiagnostics = {
  configured: boolean;
  tokenOk: boolean;
  searchOk: boolean;
  sampleCount: number;
  error?: string;
  ipWhitelistHint?: string;
};

/** 部署除錯：測試 OAuth + 一次搜尋 */
export async function diagnoseFatSecret(): Promise<FatSecretDiagnostics> {
  if (!isFatSecretConfigured()) {
    return {
      configured: false,
      tokenOk: false,
      searchOk: false,
      sampleCount: 0,
      error: "FATSECRET_CLIENT_ID or FATSECRET_CLIENT_SECRET missing",
    };
  }

  try {
    clearTokenCache();
    await fetchAccessToken();
    const items = await searchFoodWithFatSecretOnce("apple");
    return {
      configured: true,
      tokenOk: true,
      searchOk: items.length > 0,
      sampleCount: items.length,
      ipWhitelistHint:
        items.length === 0
          ? "Token OK but search empty. Check FatSecret app IP whitelist for your server (Vercel uses dynamic IPs — add ranges in FatSecret developer console or use a fixed-IP proxy)."
          : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      tokenOk: false,
      searchOk: false,
      sampleCount: 0,
      error: message,
      ipWhitelistHint:
        "FatSecret may require OAuth from whitelisted IPs. If deploying on Vercel, register Vercel IP ranges in your FatSecret application settings.",
    };
  }
}
