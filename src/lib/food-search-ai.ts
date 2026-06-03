/**
 * @deprecated 請改用 @/lib/food-search/* 模組。保留 re-export 以免舊 import 中斷。
 */
export {
  FoodSearchError,
  searchFoodWithAI,
  searchFoodWithOpenAi,
  searchFoodWithGemini,
  searchFoodLocally,
  type AiFoodSearchResult,
} from "@/lib/food-search/ai-legacy";

export {
  searchFoodWithOpenRouter,
  isOpenRouterConfigured,
  getOpenRouterModel,
  diagnoseOpenRouter,
} from "@/lib/food-search/openrouter";
