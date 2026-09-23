export type OpenFoodFactsProduct = {
  barcode: string;
  productName: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingWeightG?: number;
  sodiumMg?: number;
  sugarG?: number;
};

function readMacro(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function pickNutrient(
  nutriments: Record<string, unknown>,
  perServingKey: string,
  per100gKey: string
): number {
  const perServing = readMacro(nutriments[perServingKey]);
  if (perServing > 0) return perServing;
  return readMacro(nutriments[per100gKey]);
}

export async function lookupOpenFoodFacts(
  barcode: string
): Promise<OpenFoodFactsProduct | null> {
  const normalized = barcode.replace(/\D/g, "");
  if (!normalized) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${normalized}.json`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "NutritionCoach/1.0 (fitness-diet-saas)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.warn("[open-food-facts] lookup failed", res.status, normalized);
    return null;
  }

  const data = (await res.json()) as {
    status?: number;
    product?: Record<string, unknown>;
  };

  if (data.status !== 1 || !data.product) {
    return null;
  }

  const product = data.product;
  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;

  const calories = pickNutrient(
    nutriments,
    "energy-kcal_serving",
    "energy-kcal_100g"
  );
  const protein = pickNutrient(nutriments, "proteins_serving", "proteins_100g");
  const carbs = pickNutrient(
    nutriments,
    "carbohydrates_serving",
    "carbohydrates_100g"
  );
  const fats = pickNutrient(nutriments, "fat_serving", "fat_100g");
  const sodiumG = pickNutrient(nutriments, "sodium_serving", "sodium_100g");
  const sugarG = pickNutrient(nutriments, "sugars_serving", "sugars_100g");
  const sodiumMg = sodiumG > 0 ? Math.round(sodiumG * 1000) : 0;

  const productName =
    String(
      product.product_name_zh ||
        product.product_name ||
        product.generic_name_zh ||
        product.generic_name ||
        ""
    ).trim() || "包裝食品";

  const brand = String(product.brands || product.brand_owner || "").trim();

  const servingQuantity = readMacro(product.serving_quantity);
  const servingWeightG = servingQuantity > 0 ? servingQuantity : undefined;

  if (calories <= 0 && protein <= 0 && carbs <= 0 && fats <= 0) {
    return {
      barcode: normalized,
      productName,
      brand,
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      servingWeightG,
    };
  }

  return {
    barcode: normalized,
    productName,
    brand,
    calories,
    protein,
    carbs,
    fats,
    servingWeightG,
    sodiumMg: sodiumMg > 0 ? sodiumMg : undefined,
    sugarG: sugarG > 0 ? sugarG : undefined,
  };
}
