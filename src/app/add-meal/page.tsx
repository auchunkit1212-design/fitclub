"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { estimateMacros } from "@/lib/ai-mock";
import { compressDataUrl, compressFileImage } from "@/lib/image";
import { saveMealLog } from "@/lib/storage";
import { getSession } from "@/lib/session";

const MEAL_TYPES = ["早餐", "午餐", "晚餐", "下午茶", "宵夜", "零食"];
const CARBS_OPTIONS = ["細拳", "中拳", "大拳"];
const PROTEIN_OPTIONS = ["細掌", "中掌", "大掌"];
const VEGGIE_OPTIONS = ["有", "無"];

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export default function AddMealPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mealType, setMealType] = useState("午餐");
  const [description, setDescription] = useState("");
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [carbsPortion, setCarbsPortion] = useState("中拳");
  const [proteinPortion, setProteinPortion] = useState("中掌");
  const [hasVeggies, setHasVeggies] = useState("有");
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fats, setFats] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackPerPiece, setSnackPerPiece] = useState(80);
  const [snackQty, setSnackQty] = useState(1);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressFileImage(file);
      setImageBase64(compressed);
    } catch {
      alert("相片處理失敗，請再試一次。");
    }
    e.target.value = "";
  };

  const runFakeAi = () => {
    if (!description.trim()) {
      alert("請先填寫食物描述！");
      return;
    }
    setAiLoading(true);
    setTimeout(() => {
      const est = estimateMacros(
        description,
        carbsPortion,
        proteinPortion,
        hasVeggies
      );
      setCalories(est.calories);
      setProtein(est.protein);
      setCarbs(est.carbs);
      setFats(est.fats);
      setAiLoading(false);
    }, 1000);
  };

  const applySnackTotal = () => {
    const total = snackPerPiece * snackQty;
    setCalories(total);
    setProtein(Math.round(total * 0.08));
    setCarbs(Math.round(total * 0.12));
    setFats(Math.round(total * 0.04));
  };

  const readSessionEmail = (): string | null => {
    const session = getSession();
    return session?.email?.trim().toLowerCase() || null;
  };

  const handleSave = async () => {
    if (!description.trim()) {
      alert("請填寫食物描述！");
      return;
    }
    if (saveLoading) return;

    const email = readSessionEmail();
    if (!email) {
      alert("請先登入再記錄飲食。");
      router.push("/register");
      return;
    }

    setSaveLoading(true);

    const basePayload = {
      email,
      mealType,
      description: description.trim(),
      imageBase64,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fats: Number(fats) || 0,
    };

    const trySave = async (image?: string) => {
      await saveMealLog({ ...basePayload, imageBase64: image });
      router.push("/");
    };

    try {
      await trySave(imageBase64);
    } catch {
      if (imageBase64) {
        try {
          const compressed = await compressDataUrl(imageBase64, 960, 0.58);
          await trySave(compressed);
          alert("相片太大，已自動壓縮後上傳雲端。");
          return;
        } catch {
          try {
            const compressedHard = await compressDataUrl(imageBase64, 720, 0.42);
            await trySave(compressedHard);
            alert("相片已大幅壓縮後上傳雲端。");
            return;
          } catch {
            alert("上傳失敗，請檢查 Supabase 連線或縮小相片。");
            return;
          }
        }
      }
      alert("上傳失敗，請檢查 Supabase 連線。");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-8 max-w-lg mx-auto">
      <header className="bg-white border-b border-zinc-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className={`text-zinc-600 text-sm font-medium px-3 py-2 rounded-lg bg-zinc-100 ${btnClass}`}
          >
            ← 返回
          </button>
          <h1 className="text-lg font-bold">記錄飲食</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              餐別
            </label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base bg-white"
            >
              {MEAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              食物描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：乾炒牛河、少飯、凍奶茶走甜..."
              rows={3}
              className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              食物相片
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={handleImageClick}
              onKeyDown={(e) => e.key === "Enter" && handleImageClick()}
              className={`border-2 border-dashed border-zinc-300 rounded-2xl p-6 text-center ${btnClass}`}
            >
              {imageBase64 ? (
                <img
                  src={imageBase64}
                  alt="已上傳食物"
                  className="max-h-40 mx-auto rounded-xl object-contain"
                />
              ) : (
                <p className="text-zinc-500">
                  📷 撳一下上傳相片（儲存喺記憶體，唔寫入硬碟）
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
          <h2 className="font-semibold text-zinc-800">快速份量估算</h2>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-zinc-500">碳水（拳頭大小）</label>
              <select
                value={carbsPortion}
                onChange={(e) => setCarbsPortion(e.target.value)}
                className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                {CARBS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">蛋白質（手掌大小）</label>
              <select
                value={proteinPortion}
                onChange={(e) => setProteinPortion(e.target.value)}
                className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                {PROTEIN_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">蔬菜</label>
              <select
                value={hasVeggies}
                onChange={(e) => setHasVeggies(e.target.value)}
                className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                {VEGGIE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={aiLoading}
            onClick={runFakeAi}
            className={`w-full bg-violet-600 text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 ${btnClass}`}
          >
            {aiLoading ? "AI 分析緊..." : "🤖 啟動 AI 多模態估算"}
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setSnackOpen(!snackOpen)}
            className={`w-full flex justify-between items-center font-semibold text-zinc-800 ${btnClass}`}
          >
            <span>🍪 零食計算機</span>
            <span className="text-zinc-400">{snackOpen ? "▲" : "▼"}</span>
          </button>
          {snackOpen && (
            <div className="mt-4 space-y-3 pt-3 border-t border-zinc-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500">每件卡路里</label>
                  <input
                    type="number"
                    value={snackPerPiece}
                    onChange={(e) => setSnackPerPiece(Number(e.target.value))}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500">數量</label>
                  <input
                    type="number"
                    min={1}
                    value={snackQty}
                    onChange={(e) => setSnackQty(Number(e.target.value))}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
                  />
                </div>
              </div>
              <p className="text-sm text-zinc-600">
                總計: {snackPerPiece * snackQty} kcal
              </p>
              <button
                type="button"
                onClick={applySnackTotal}
                className={`w-full bg-amber-500 text-white font-medium py-3 rounded-xl ${btnClass}`}
              >
                套用總卡路里
              </button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
          <h2 className="font-semibold text-zinc-800">手動調整營養素</h2>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["熱量 (kcal)", calories, setCalories],
                ["蛋白質 (g)", protein, setProtein],
                ["碳水 (g)", carbs, setCarbs],
                ["脂肪 (g)", fats, setFats],
              ] as const
            ).map(([label, val, setter]) => (
              <div key={label}>
                <label className="text-xs text-zinc-500">{label}</label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => setter(Number(e.target.value))}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
                />
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveLoading}
          className={`w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg text-lg disabled:opacity-60 ${btnClass}`}
        >
          {saveLoading ? "儲存中..." : "儲存記錄"}
        </button>
      </main>
    </div>
  );
}
