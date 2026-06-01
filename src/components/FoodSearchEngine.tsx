"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useDebounce } from "@/hooks/useDebounce";
import { getSessionRequestHeaders } from "@/lib/session";
import type { FavoriteFood, FoodSearchItem } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 400;

interface FoodSearchEngineProps {
  onAddToMeal: (item: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    fromSearch: boolean;
  }) => void;
}

export function FoodSearchEngine({ onAddToMeal }: FoodSearchEngineProps) {
  const { lang, t } = useI18n();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);
  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FoodSearchItem | null>(null);
  const [lastSource, setLastSource] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
        setLoading(false);
        return;
      }

      const seq = ++searchSeq.current;
      setLoading(true);

      try {
        const res = await fetch("/api/food-search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getSessionRequestHeaders(),
          },
          credentials: "include",
          body: JSON.stringify({ query: trimmed, lang }),
        });
        const data = (await res.json()) as {
          items?: FoodSearchItem[];
          source?: string;
          error?: string;
          fatSecretConfigured?: boolean;
        };

        if (seq !== searchSeq.current) return;

        if (!res.ok) {
          setResults([]);
          setLastSource(null);
          return;
        }

        const items = data.items ?? [];
        setResults(items);
        const primarySource =
          items[0]?.source ?? data.source ?? null;
        setLastSource(primarySource);
      } catch {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setLastSource(null);
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    },
    [lang]
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

  const selectResult = (item: FoodSearchItem) => {
    const desc = item.brand ? `${item.brand} ${item.name}` : item.name;
    setQuery(desc);
    setSelectedItem(item);
    setDropdownOpen(false);
    onAddToMeal({
      description: desc,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      fromSearch: true,
    });
  };

  const quickAddFavorite = (item: FavoriteFood) => {
    setQuery(item.name);
    setSelectedItem({
      id: item.id,
      name: item.name,
      brand: item.brand,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      servingLabel: item.servingLabel,
      source: "local",
    });
    setDropdownOpen(false);
    onAddToMeal({
      description: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      fromSearch: true,
    });
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

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900">
          🔍 {t("foodSearch.title", "巨型食物搜尋引擎")}
        </h2>
        {(lastSource === "fatsecret" ||
          results.some((r) => r.source === "fatsecret")) && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
            FatSecret
          </span>
        )}
        {lastSource === "hk" && !results.some((r) => r.source === "fatsecret") && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
            {t("foodSearch.sourceHk", "茶餐廳資料庫")}
          </span>
        )}
        {(lastSource === "local" ||
          lastSource === "gemini" ||
          lastSource === "openai") &&
          !results.some((r) => r.source === "fatsecret") && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {t("foodSearch.sourceLocal", "智能估算")}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {t(
          "foodSearch.hint",
          "輸入「冰室叉燒飯」、「茶走」、「雞胸肉」等，AI 即時估算標準一人份營養素"
        )}
      </p>

      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedItem(null);
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
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-10 text-sm text-gray-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {showDropdown && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
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

            {showEmpty && (
              <p className="px-3 py-3 text-sm text-gray-500">
                {t(
                  "foodSearch.noResultsDropdown",
                  "找不到相符的食物，請嘗試其他關鍵字"
                )}
              </p>
            )}

            {!loading &&
              results.map((item) => {
                const label = item.brand ? `${item.brand} · ${item.name}` : item.name;
                const active = hoveredId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => selectResult(item)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 transition-colors ${btnClass} ${
                      active ? "bg-emerald-50" : "bg-white hover:bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {label}
                      </span>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {item.source === "fatsecret" && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-sky-100 text-sky-800">
                            FS
                          </span>
                        )}
                        <span className="text-sm font-semibold text-emerald-600">
                          {item.calories} kcal
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {item.servingLabel && (
                        <span className="text-gray-400">{item.servingLabel} · </span>
                      )}
                      {t("common.protein", "蛋白")} {item.protein}g ·{" "}
                      {t("common.carbs", "碳水")} {item.carbs}g · {t("common.fat", "脂肪")}{" "}
                      {item.fats}g
                    </p>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-3 shadow-sm space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{selectedItem.name}</p>
              {selectedItem.brand && (
                <p className="text-xs text-gray-500 truncate">{selectedItem.brand}</p>
              )}
            </div>
            <span className="shrink-0 text-lg font-black text-emerald-600">
              {selectedItem.calories}
              <span className="text-xs font-semibold ml-0.5">kcal</span>
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                [t("common.protein", "蛋白"), selectedItem.protein, "bg-sky-100 text-sky-800"],
                [t("common.carbs", "碳水"), selectedItem.carbs, "bg-amber-100 text-amber-800"],
                [t("common.fat", "脂肪"), selectedItem.fats, "bg-rose-100 text-rose-800"],
              ] as const
            ).map(([label, val, cls]) => (
              <span
                key={String(label)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}
              >
                {label} {val}g
              </span>
            ))}
          </div>
          <p className="text-xs text-emerald-700 font-medium">
            {t("foodSearch.addedHint", "✓ 已帶入表單，撳「發布記錄」即可儲存")}
          </p>
          <button
            type="button"
            onClick={() => saveFavorite(selectedItem)}
            className="text-[11px] text-gray-500 hover:text-amber-600"
          >
            {t("foodSearch.addFavorite", "⭐ 加入常用")}
          </button>
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
    </section>
  );
}
