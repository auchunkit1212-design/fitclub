"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { getSessionRequestHeaders } from "@/lib/session";
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
    fromSearch: boolean;
  }) => void;
}

export function FoodSearchEngine({ onAddToMeal }: FoodSearchEngineProps) {
  const { lang } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<string | null>(null);

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
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedId(null);
    try {
      const res = await fetch("/api/food-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionRequestHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ query: q, lang }),
      });
      const data = (await res.json()) as {
        items?: FoodSearchItem[];
        source?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "搜尋失敗");
        return;
      }
      setResults(data.items ?? []);
      setLastSource(data.source ?? null);
      if ((data.items ?? []).length === 0) {
        setError("搵唔到相關食物，請換個關鍵字再試");
      }
    } catch {
      setError("網絡錯誤，請稍後再試");
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

  const selectResult = (item: FoodSearchItem) => {
    setSelectedId(item.id);
    const desc = item.brand ? `${item.brand} ${item.name}` : item.name;
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
    onAddToMeal({
      description: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      fromSearch: true,
    });
  };

  return (
    <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-800">🔍 巨型食物搜尋引擎</h2>
        {lastSource === "fatsecret" && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
            FatSecret
          </span>
        )}
        {lastSource === "hk" && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
            茶餐廳資料庫
          </span>
        )}
        {lastSource === "local" && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            智能估算
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        輸入「冰室叉燒飯」、「茶走」、「雞胸肉」等，AI 即時估算標準一人份營養素
      </p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="搜尋食物名稱..."
          disabled={loading}
          className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm disabled:opacity-60"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading || !query.trim()}
          className={`shrink-0 px-4 py-2.5 rounded-xl bg-[#7ED321] text-white text-sm font-semibold disabled:opacity-60 ${btnClass}`}
        >
          {loading ? "分析中..." : "搜尋"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#7ED321]/10 border border-[#7ED321]/30">
          <div className="w-5 h-5 border-2 border-[#7ED321] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#5fa718] font-medium">
            AI 正在分析「{query.trim()}」的營養素...
          </p>
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {results.length > 0 && !loading && (
        <ul className="space-y-2">
          {results.map((item) => {
            const selected = selectedId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => selectResult(item)}
                  className={`w-full text-left p-3 rounded-2xl border-2 transition-all ${btnClass} ${
                    selected
                      ? "border-emerald-500 bg-emerald-50 shadow-sm"
                      : "border-zinc-100 bg-zinc-50 hover:border-[#7ED321]/40 hover:bg-[#7ED321]/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {item.servingLabel}
                        {item.weightG ? ` · 約 ${item.weightG}g` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-black text-emerald-600">
                      {item.calories}
                      <span className="text-xs font-semibold ml-0.5">kcal</span>
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[
                      ["蛋白", item.protein, "bg-sky-100 text-sky-800"],
                      ["碳水", item.carbs, "bg-amber-100 text-amber-800"],
                      ["脂肪", item.fats, "bg-rose-100 text-rose-800"],
                    ].map(([label, val, cls]) => (
                      <span
                        key={String(label)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}
                      >
                        {label} {val}g
                      </span>
                    ))}
                  </div>
                  {selected && (
                    <p className="text-xs text-emerald-700 font-medium mt-2">
                      ✓ 已帶入表單，撳「發布記錄」即可儲存
                    </p>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    saveFavorite(item);
                  }}
                  className="mt-1 text-[11px] text-zinc-400 hover:text-amber-600 px-1"
                >
                  ⭐ 加入常用
                </button>
              </li>
            );
          })}
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
                  onClick={() => quickAddFavorite(f)}
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
