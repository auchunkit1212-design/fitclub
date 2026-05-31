"use client";

import { useCallback, useEffect, useState } from "react";
import type { FavoriteFood, FoodSearchItem } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface FoodSearchEngineProps {
  onAddToMeal: (item: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => void;
}

export function FoodSearchEngine({ onAddToMeal }: FoodSearchEngineProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [loading, setLoading] = useState(false);

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

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/food/search?q=${encodeURIComponent(query.trim())}`
      );
      const data = (await res.json()) as { items?: FoodSearchItem[] };
      setResults(data.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  const saveFavorite = async (item: FoodSearchItem) => {
    await fetch("/api/food/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    loadFavorites();
  };

  const quickAdd = (item: {
    name: string;
    brand?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => {
    const desc = item.brand ? `${item.brand} ${item.name}` : item.name;
    onAddToMeal({
      description: desc,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
    });
  };

  return (
    <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3">
      <h2 className="font-semibold text-zinc-800">🔍 巨型食物搜尋引擎</h2>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="搜尋品牌 / 食物名稱..."
          className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className={`shrink-0 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-60 ${btnClass}`}
        >
          {loading ? "..." : "搜尋"}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {results.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-100"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {item.name}
                  {item.brand && (
                    <span className="text-zinc-400 font-normal"> · {item.brand}</span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {item.calories} kcal · P{item.protein} C{item.carbs} F{item.fats} ·{" "}
                  {item.servingLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => quickAdd(item)}
                className={`w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-lg ${btnClass}`}
              >
                +
              </button>
            </li>
          ))}
        </ul>
      )}

      {favorites.length > 0 && (
        <div className="pt-2 border-t border-zinc-100">
          <p className="text-xs font-semibold text-zinc-500 mb-2">⭐ 常用 / 歷史</p>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {favorites.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 border border-amber-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-zinc-500">
                    {f.calories} kcal · 用過 {f.useCount} 次
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => quickAdd(f)}
                  className={`w-9 h-9 rounded-full bg-amber-500 text-white font-bold text-lg ${btnClass}`}
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
