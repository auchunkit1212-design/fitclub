"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { AdvancedNutritionCard } from "@/components/AdvancedNutritionCard";
import { CheckCircle2, IconLabel, Search } from "@/components/icons";
import { NutritionLabelOcrButton } from "@/components/NutritionLabelOcrButton";
import { ServingPortionPicker } from "@/components/ServingPortionPicker";
import { useDebounce } from "@/hooks/useDebounce";
import { hasAiAdvancedNutrients } from "@/lib/food-advanced-nutrients";
import type { OcrNutritionResult } from "@/lib/ocr-nutrition";
import type { MealBaselineSource } from "@/lib/meal-ai-verify";
import {
  parseGramsFromLabel,
  scaleAdvancedNutrients,
  scaleMacros,
  type MacroValues,
} from "@/lib/portion-scale";
import { getSessionRequestHeaders } from "@/lib/session";
import type { FavoriteFood, FoodAdvancedNutrients, FoodSearchItem } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;
const SEARCH_TIMEOUT_MS = 15_000;

export type PortionBasePayload = {
  productName: string;
  macros: MacroValues;
  advanced?: FoodAdvancedNutrients;
  baseWeightG?: number;
  proNutrition?: boolean;
  nutritionSource?: MealBaselineSource;
};

function nutritionSourceFromItem(item: FoodSearchItem): MealBaselineSource {
  if (item.id === "ocr-nutrition-label") return "ocr";
  if (item.source === "openrouter") return "openrouter";
  if (
    item.source === "hk_711" ||
    item.source === "hk_tw" ||
    item.source === "local"
  ) {
    return "local_db";
  }
  return "manual";
}

interface FoodSearchEngineProps {
  onAddToMeal: (item: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    fromSearch: boolean;
    advanced?: FoodAdvancedNutrients;
    proNutrition?: boolean;
    portionBase?: PortionBasePayload;
    nutritionSource?: MealBaselineSource;
  }) => void;
  /** Strip outer card chrome when used inside a bottom sheet */
  embedded?: boolean;
}

export function FoodSearchEngine({
  onAddToMeal,
  embedded = false,
}: FoodSearchEngineProps) {
  const { lang, t } = useI18n();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);
  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FoodSearchItem | null>(null);
  const [lastSource, setLastSource] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [portionBase, setPortionBase] = useState<
    (PortionBasePayload & { itemMeta?: FoodSearchItem }) | null
  >(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/food/favorites");
      const data = (await res.json()) as { favorites?: FavoriteFood[] };
      setFavorites(data.favorites ?? []);
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setLastSource(null);
        setSearchError(null);
        setLoading(false);
        return;
      }

      const seq = ++searchSeq.current;
      setLoading(true);
      setSearchError(null);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        SEARCH_TIMEOUT_MS
      );

      try {
        const res = await fetch("/api/food-search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getSessionRequestHeaders(),
          },
          credentials: "include",
          body: JSON.stringify({ query: trimmed, lang }),
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          items?: FoodSearchItem[];
          source?: string;
          error?: string;
          databaseSize?: number;
        };

        if (seq !== searchSeq.current) return;

        if (!res.ok) {
          setResults([]);
          setLastSource(null);
          if (res.status === 401) {
            setSearchError(
              t("foodSearch.loginRequired", "請先登入後再搜尋食物")
            );
          } else {
            setSearchError(
              data.error ??
                t("foodSearch.searchFailed", "搜尋失敗，請稍後再試")
            );
          }
          return;
        }

        const items = data.items ?? [];
        setResults(items);
        setSearchError(null);
        setLastSource(items[0]?.source ?? data.source ?? "openrouter");
      } catch (err) {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setLastSource(null);
        const timedOut = err instanceof Error && err.name === "AbortError";
        setSearchError(
          timedOut
            ? t("foodSearch.searchTimeout", "搜尋逾時，請再試一次")
            : t("foodSearch.searchFailed", "搜尋失敗，請稍後再試")
        );
      } finally {
        window.clearTimeout(timeoutId);
        if (seq === searchSeq.current) setLoading(false);
      }
    },
    [lang, t]
  );

  useEffect(() => {
    if (!dropdownOpen) return;
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLastSource(null);
      setLoading(false);
      return;
    }
    runSearch(trimmed);
  }, [debouncedQuery, dropdownOpen, runSearch]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const saveFavorite = async (item: FoodSearchItem) => {
    await fetch("/api/food/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    loadFavorites();
  };

  const pushPortionedMeal = useCallback(
    (
      base: PortionBasePayload & { itemMeta?: FoodSearchItem },
      ratio: number,
      description: string
    ) => {
      const scaled = scaleMacros(base.macros, ratio);
      const scaledAdvanced = scaleAdvancedNutrients(base.advanced, ratio);
      onAddToMeal({
        description,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fats: scaled.fats,
        fromSearch: true,
        advanced: scaledAdvanced,
        proNutrition: base.proNutrition,
        portionBase: {
          productName: base.productName,
          macros: base.macros,
          advanced: base.advanced,
          baseWeightG: base.baseWeightG,
          proNutrition: base.proNutrition,
          nutritionSource: base.nutritionSource,
        },
        nutritionSource: base.nutritionSource,
      });
      setQuery(description);
      if (base.itemMeta) {
        setSelectedItem({
          ...base.itemMeta,
          name: base.productName,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fats: scaled.fats,
          fiberG: scaledAdvanced?.fiberG,
          sugarG: scaledAdvanced?.sugarG,
          saturatedFatG: scaledAdvanced?.saturatedFatG,
          sodiumMg: scaledAdvanced?.sodiumMg,
          cholesterolMg: scaledAdvanced?.cholesterolMg,
        });
      }
    },
    [onAddToMeal]
  );

  const handlePortionChange = useCallback(
    (ratio: number, _portionLabel: string, description: string) => {
      if (!portionBase) return;
      pushPortionedMeal(portionBase, ratio, description);
    },
    [portionBase, pushPortionedMeal]
  );

  const beginPortionSelection = (
    item: FoodSearchItem,
    productName: string,
    proNutrition?: boolean
  ) => {
    setPortionBase({
      productName,
      macros: {
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
      },
      advanced: {
        fiberG: item.fiberG,
        sugarG: item.sugarG,
        saturatedFatG: item.saturatedFatG,
        sodiumMg: item.sodiumMg,
        cholesterolMg: item.cholesterolMg,
      },
      baseWeightG: parseGramsFromLabel(item.servingLabel),
      proNutrition,
      itemMeta: item,
      nutritionSource: nutritionSourceFromItem(item),
    });
    setSelectedItem(item);
    setDropdownOpen(false);
  };

  const selectResult = (item: FoodSearchItem) => {
    const productName = item.brand ? `${item.brand} ${item.name}` : item.name;
    beginPortionSelection(
      item,
      productName,
      item.source === "openrouter" && hasAiAdvancedNutrients(item)
    );
  };

  const quickAddFavorite = (item: FavoriteFood) => {
    const foodItem: FoodSearchItem = {
      id: item.id,
      name: item.name,
      brand: item.brand,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      servingLabel: item.servingLabel,
      source: "local",
    };
    beginPortionSelection(foodItem, item.name);
  };

  const handleOcrSuccess = (v: OcrNutritionResult) => {
    const productName =
      v.brand && v.productName
        ? `${v.brand} ${v.productName}`.trim()
        : v.productName;
    const item: FoodSearchItem = {
      id: "ocr-nutrition-label",
      name: productName,
      brand: v.brand,
      calories: v.calories,
      protein: v.protein,
      carbs: v.carbs,
      fats: v.fat,
      servingLabel:
        v.servingWeightG > 0
          ? `約 ${v.servingWeightG}g`
          : t("nutritionOcr.perServing", "每份"),
      source: "openrouter",
      sodiumMg: v.sodium > 0 ? v.sodium : undefined,
      sugarG: v.sugar > 0 ? v.sugar : undefined,
    };
    beginPortionSelection(item, productName, v.sodium > 0 || v.sugar > 0);
  };

  const trimmedQuery = query.trim();
  const showDropdown = dropdownOpen && trimmedQuery.length > 0;
  const showMinChars =
    showDropdown && trimmedQuery.length < MIN_QUERY_LENGTH && !loading;
  const showEmpty =
    showDropdown &&
    !loading &&
    trimmedQuery.length >= MIN_QUERY_LENGTH &&
    results.length === 0;

  const Wrapper = embedded ? "div" : "section";
  const wrapperClass = embedded
    ? "space-y-3"
    : "soft-card p-4 space-y-3";

  return (
    <Wrapper className={wrapperClass}>
      <NutritionLabelOcrButton onSuccess={handleOcrSuccess} />

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900">
          <IconLabel icon={Search} iconClassName="text-gray-600">
            {t("foodSearch.title", "巨型食物搜尋引擎")}
          </IconLabel>
        </h2>
        {(lastSource === "openrouter" ||
          results.some((r) => r.source === "openrouter")) && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
            {t("foodSearch.sourceAi", "AI 聯想")}
          </span>
        )}
        {results.some((r) => r.source === "hk_711") && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
            {t("foodSearch.source711", "7-11 資料庫")}
          </span>
        )}
        {results.some((r) => r.source === "hk_tw") && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {t("foodSearch.sourceLocal", "本地資料庫")}
          </span>
        )}
      </div>

      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedItem(null);
              setPortionBase(null);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDropdownOpen(false);
              if (e.key === "Enter" && trimmedQuery.length >= MIN_QUERY_LENGTH) {
                runSearch(trimmedQuery);
                setDropdownOpen(true);
              }
            }}
            placeholder={t("foodSearch.placeholder", "搜尋食物名稱...")}
            autoComplete="off"
            className="w-full rounded-2xl border border-gray-100 px-3 py-3 pr-10 text-sm text-gray-900 bg-white shadow-[0_4px_16px_rgb(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-emerald-600/40 focus:border-emerald-600"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {showDropdown && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-[0_12px_40px_rgb(0,0,0,0.08)]"
            role="listbox"
          >
            {showMinChars && (
              <p className="px-3 py-3 text-sm text-gray-500">
                {t("foodSearch.minCharsHint", "繼續輸入以顯示建議…")}
              </p>
            )}

            {loading && trimmedQuery.length >= MIN_QUERY_LENGTH && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-emerald-700">
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                {t("foodSearch.searching", "搜尋中...")}
              </div>
            )}

            {showEmpty && searchError && (
              <p className="px-3 py-3 text-sm text-amber-700">{searchError}</p>
            )}

            {showEmpty && !searchError && (
              <p className="px-3 py-3 text-sm text-gray-500">
                {t(
                  "foodSearch.noResultsDropdown",
                  "找不到相符的食物，請嘗試其他關鍵字"
                )}
              </p>
            )}

            {!loading &&
              results.map((item) => {
                const active = hoveredId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => selectResult(item)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 transition-colors ${btnClass} ${
                      active ? "bg-emerald-50" : "bg-white hover:bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-sm text-gray-400 tabular-nums">
                        {item.calories}{" "}
                        <span className="text-xs">kcal</span>
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="space-y-3">
          {portionBase && (
            <ServingPortionPicker
              baseWeightG={portionBase.baseWeightG}
              productName={portionBase.productName}
              onPortionChange={handlePortionChange}
            />
          )}
          <AdvancedNutritionCard
            name={selectedItem.brand ? `${selectedItem.brand} ${selectedItem.name}` : selectedItem.name}
            macros={{
              calories: selectedItem.calories,
              protein: selectedItem.protein,
              carbs: selectedItem.carbs,
              fats: selectedItem.fats,
            }}
            advanced={{
              fiberG: selectedItem.fiberG,
              sugarG: selectedItem.sugarG,
              saturatedFatG: selectedItem.saturatedFatG,
              sodiumMg: selectedItem.sodiumMg,
              cholesterolMg: selectedItem.cholesterolMg,
            }}
            proSource={
              selectedItem.source === "openrouter" &&
              hasAiAdvancedNutrients(selectedItem)
            }
          />
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-sm">
          <p className="text-xs text-emerald-700 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} strokeWidth={2} className="shrink-0 text-emerald-700" aria-hidden />
              {t("foodSearch.addedHint", "已帶入表單，撳「發布記錄」即可儲存")}
            </span>
          </p>
          <button
            type="button"
            onClick={() => saveFavorite(selectedItem)}
            className="text-[11px] text-gray-500 hover:text-amber-600"
          >
            {t("foodSearch.addFavorite", "加入常用")}
          </button>
          </div>
        </div>
      )}

      {favorites.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">
            {t("foodSearch.favorites", "⭐ 常用 / 歷史")}
          </p>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {favorites.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 border border-amber-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-gray-500">
                    {f.calories} kcal ·{" "}
                    {t("foodSearch.usedTimes", "用過 {count} 次", { count: f.useCount })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => quickAddFavorite(f)}
                  className={`w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-lg ${btnClass}`}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Wrapper>
  );
}
