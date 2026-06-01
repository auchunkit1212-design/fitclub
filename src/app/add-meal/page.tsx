"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FoodSearchEngine } from "@/components/FoodSearchEngine";
import { useI18n } from "@/components/I18nProvider";
import { OnboardingModal } from "@/components/OnboardingModal";
import { NutritionDashboard } from "@/components/NutritionDashboard";
import { PageHeader } from "@/components/PageHeader";
import { SnackLabelScanner } from "@/components/SnackLabelScanner";
import { PORTION_NONE, estimateMacros } from "@/lib/ai-mock";
import {
  computeTargetProfile,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import {
  fetchStudentBodyProfile,
  fetchUsersForSession,
} from "@/lib/db";
import { compressDataUrl, compressFileImage } from "@/lib/image";
import { uploadMealImageFromClient } from "@/lib/meal-image-storage";
import { initUserRegistry } from "@/lib/registry";
import { getSession, saveSession, getSessionRequestHeaders } from "@/lib/session";
import { errorMessage } from "@/lib/errors";
import { getSupabasePublicEnvStatus } from "@/lib/supabase-env";
import { getMealLogs, isToday, saveMealLog } from "@/lib/storage";
import type { MealLog, StudentBodyProfile, UserSession } from "@/lib/types";

const MEAL_TYPES = ["早餐", "午餐", "晚餐", "下午茶", "宵夜", "零食"];
const CARBS_OPTIONS = [PORTION_NONE, "細拳", "中拳", "大拳"];
const PROTEIN_OPTIONS = [PORTION_NONE, "細掌", "中掌", "大掌"];
const VEGGIE_OPTIONS = [PORTION_NONE, "有"];

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export default function AddMealPage() {
  const router = useRouter();
  const { t } = useI18n();
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
  const [saveLoading, setSaveLoading] = useState(false);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackPerPiece, setSnackPerPiece] = useState(80);
  const [snackQty, setSnackQty] = useState(1);
  const [bodyProfile, setBodyProfile] = useState<StudentBodyProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [todayLogs, setTodayLogs] = useState<MealLog[]>([]);
  const [goalCalories, setGoalCalories] = useState(2000);
  const [goalProtein, setGoalProtein] = useState(120);
  const [goalCarbs, setGoalCarbs] = useState(200);
  const [goalFats, setGoalFats] = useState(65);
  const [showNutritionDash, setShowNutritionDash] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [macrosFromSearch, setMacrosFromSearch] = useState(false);

  useEffect(() => {
    const parsed = getSession();
    if (!parsed?.email) {
      router.push("/register");
      return;
    }
    const active: UserSession = { ...parsed, isLoggedIn: true };
    setSession(active);

    (async () => {
      const envStatus = getSupabasePublicEnvStatus();
      if (!envStatus.ok) {
        console.error("[add-meal] Supabase env missing", envStatus);
      } else {
        console.log("[add-meal] Supabase env ok", envStatus.urlPreview);
      }

      try {
        await initUserRegistry();
        const registry = await fetchUsersForSession(active);
        const logs = await getMealLogs(active, registry);
        setTodayLogs(logs.filter((l) => isToday(l.date)));

        if (active.role === "student") {
          const body = await fetchStudentBodyProfile(active.email);
          setBodyProfile(body);
          if (body && isBodyProfileComplete(body)) {
            const targets = computeTargetProfile(body);
            setGoalCalories(targets.targetCalories);
            setGoalProtein(targets.targetProtein);
          }
          const tRes = await fetch("/api/coach/student-targets");
          const tData = (await tRes.json()) as {
            targets?: {
              locked: boolean;
              targetCalories: number;
              targetProtein: number;
              targetCarbs: number;
              targetFats: number;
            };
          };
          if (tData.targets?.locked) {
            setGoalCalories(tData.targets.targetCalories);
            setGoalProtein(tData.targets.targetProtein);
            setGoalCarbs(tData.targets.targetCarbs);
            setGoalFats(tData.targets.targetFats);
          }
        }
      } finally {
        setProfileChecked(true);
      }
    })();
  }, [router]);

  const needsOnboarding =
    session?.role === "student" &&
    profileChecked &&
    !isBodyProfileComplete(bodyProfile);

  const exerciseDaily = bodyProfile?.exerciseCaloriesDaily ?? 0;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageCompressing(true);
    try {
      const compressed = await compressFileImage(file);
      setImageBase64(compressed);
    } catch (err) {
      console.error("[add-meal] image compress failed", err);
      alert("相片壓縮失敗，請換一張較細的相片或再試一次。");
    } finally {
      setImageCompressing(false);
      e.target.value = "";
    }
  };

  const applySnackTotal = () => {
    const total = snackPerPiece * snackQty;
    setCalories(total);
    setProtein(Math.round(total * 0.08));
    setCarbs(Math.round(total * 0.12));
    setFats(Math.round(total * 0.04));
  };

  const readSessionEmail = (): string | null => {
    const s = getSession();
    return s?.email?.trim().toLowerCase() || null;
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

    const currentSession = getSession();
    if (currentSession) saveSession(currentSession);

    let finalCalories = calories;
    let finalProtein = protein;
    let finalCarbs = carbs;
    let finalFats = fats;

    if (macrosFromSearch && calories > 0) {
      // 巨型食物搜尋引擎已帶入 AI 估算，直接沿用表單數值
    } else {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const aiEst = estimateMacros(
        description.trim(),
        carbsPortion,
        proteinPortion,
        hasVeggies
      );
      finalCalories = aiEst.calories;
      finalProtein = aiEst.protein;
      finalCarbs = aiEst.carbs;
      finalFats = aiEst.fats;
      setCalories(aiEst.calories);
      setProtein(aiEst.protein);
      setCarbs(aiEst.carbs);
      setFats(aiEst.fats);
    }

    let imageToUpload = imageBase64;
    if (imageBase64) {
      try {
        imageToUpload = await compressDataUrl(imageBase64);
        setImageBase64(imageToUpload);
      } catch (err) {
        console.error("[add-meal] pre-upload compress failed", err);
        alert("相片壓縮失敗，請重新選擇相片。");
        setSaveLoading(false);
        return;
      }
    }

    let uploadedImageUrl: string | undefined;
    if (imageToUpload) {
      try {
        uploadedImageUrl = await uploadMealImageFromClient(email, imageToUpload);
        console.log("[add-meal] Storage upload ok (anon client)", uploadedImageUrl);
      } catch (storageErr) {
        console.error("[add-meal] Storage upload failed (anon client)", storageErr);
        const msg = errorMessage(storageErr, "Storage failed");
        const skipPhoto = window.confirm(
          `相片無法上傳至 food-images：\n${msg}\n\n是否仍要儲存飲食記錄（不含相片）？`
        );
        if (!skipPhoto) {
          setSaveLoading(false);
          return;
        }
        uploadedImageUrl = undefined;
      }
    }

    const basePayload = {
      email,
      mealType,
      description: description.trim(),
      calories: finalCalories,
      protein: finalProtein,
      carbs: finalCarbs,
      fats: finalFats,
    };

    const mealPayload = {
      email,
      mealType: basePayload.mealType,
      description: basePayload.description,
      calories: basePayload.calories,
      protein: basePayload.protein,
      carbs: basePayload.carbs,
      fats: basePayload.fats,
    };

    const saveDirect = async (imageUrl?: string) => {
      await saveMealLog({ ...mealPayload, imageUrl });
    };

    const trySave = async (imageUrl?: string) => {
      let res: Response | null = null;
      try {
        res = await fetch("/api/meals/log", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getSessionRequestHeaders(),
          },
          credentials: "include",
          body: JSON.stringify({ ...basePayload, imageUrl }),
        });
      } catch (networkErr) {
        console.warn("[add-meal] API network error, fallback direct save", networkErr);
        await saveDirect(imageUrl);
        router.push("/");
        return;
      }

      if (res.ok) {
        router.push("/");
        return;
      }

      let errBody: {
        error?: string;
        code?: string;
        detail?: string;
        hint?: string;
      } = {};
      try {
        errBody = (await res.json()) as typeof errBody;
      } catch {
        errBody = { error: `HTTP ${res.status}` };
      }
      console.error("[add-meal] API error", { status: res.status, ...errBody });

      try {
        console.warn("[add-meal] fallback direct Supabase save");
        await saveDirect(imageUrl);
        router.push("/");
      } catch (directErr) {
        console.error("[add-meal] direct save failed", directErr);
        throw new Error(
          errorMessage(
            directErr,
            errBody.error ??
              (errBody.code === "DB_ERROR"
                ? `資料庫錯誤：${errBody.hint ?? "請執行 storage-food-images.sql"}`
                : `儲存失敗 (HTTP ${res.status})`)
          )
        );
      }
    };

    try {
      await trySave(uploadedImageUrl);
    } catch (err) {
      console.error("[add-meal] save failed", err);
      alert(errorMessage(err, "上傳失敗，請檢查 Supabase 連線"));
    } finally {
      setSaveLoading(false);
    }
  };

  if (!profileChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        載入中...
      </div>
    );
  }

  if (needsOnboarding && session?.email) {
    return (
      <OnboardingModal
        email={session.email}
        initial={bodyProfile ?? undefined}
        soloMode={Boolean(session.isSoloStudent)}
        onComplete={(saved) => {
          setBodyProfile(saved);
          setGoalCalories(computeTargetProfile(saved).targetCalories);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white pb-safe max-w-lg mx-auto">
      {showNutritionDash && (
        <NutritionDashboard
          logs={todayLogs}
          goalCalories={goalCalories}
          goalProtein={goalProtein}
          goalCarbs={goalCarbs}
          goalFats={goalFats}
          exerciseCalories={exerciseDaily}
          onClose={() => setShowNutritionDash(false)}
          onExerciseChange={async (kcal) => {
            if (!session?.email || !bodyProfile) return;
            const res = await fetch("/api/student/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                heightCm: bodyProfile.heightCm,
                weightKg: bodyProfile.weightKg,
                age: bodyProfile.age,
                gender: bodyProfile.gender,
                targetWeightKg: bodyProfile.targetWeightKg,
                exerciseCaloriesDaily: kcal,
              }),
            });
            const data = (await res.json()) as { profile?: StudentBodyProfile };
            if (data.profile) setBodyProfile(data.profile);
          }}
        />
      )}

      <PageHeader
        title={t("addMeal.title", "記錄飲食")}
        onBack={() => router.push("/")}
        backLabel="← 返回"
      />

      <main className="px-4 py-4 space-y-4">
        <button
          type="button"
          onClick={() => setShowNutritionDash(true)}
          className={`w-full bg-[#7ED321] text-white font-bold py-3.5 rounded-2xl shadow-md ${btnClass}`}
        >
          📊 高級營養分析
        </button>

        <FoodSearchEngine
          onAddToMeal={(item) => {
            setDescription(item.description);
            setCalories(item.calories);
            setProtein(item.protein);
            setCarbs(item.carbs);
            setFats(item.fats);
            setMacrosFromSearch(item.fromSearch);
          }}
        />

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
              onChange={(e) => {
                setDescription(e.target.value);
                setMacrosFromSearch(false);
              }}
              placeholder="例如：牛肉叉燒拉麵、茶餐廳乾炒牛河..."
              rows={3}
              className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t("addMeal.uploadPhoto", "上傳相片")}
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
              onClick={imageCompressing ? undefined : handleImageClick}
              onKeyDown={(e) =>
                !imageCompressing && e.key === "Enter" && handleImageClick()
              }
              className={`border-2 border-dashed border-zinc-300 rounded-2xl p-6 text-center ${
                imageCompressing ? "opacity-70 pointer-events-none" : btnClass
              }`}
            >
              {imageCompressing ? (
                <p className="text-zinc-600 font-medium">壓縮相片中...</p>
              ) : imageBase64 ? (
                <img
                  src={imageBase64}
                  alt="已上傳食物"
                  className="max-h-40 mx-auto rounded-xl object-contain"
                />
              ) : (
                <p className="text-zinc-500">
                  📷 {t("addMeal.uploadPhoto", "上傳相片")}（自動壓縮至 1MB 內）
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
          <h2 className="font-semibold text-zinc-800">快速份量估算</h2>
          <p className="text-xs text-zinc-500">
            AI 已啟用外食隱形熱量修正（湯底、紅油、用油）
          </p>
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

          <p className="text-xs text-zinc-500">
            儲存時會自動 AI 估算熱量同 Macros（無需再撳下面掣）
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setSnackOpen(!snackOpen)}
            className={`w-full flex justify-between items-center font-semibold text-zinc-800 ${btnClass}`}
          >
            <span>🍪 {t("addMeal.calculateCalories", "計算卡路里")}</span>
            <span className="text-zinc-400">{snackOpen ? "▲" : "▼"}</span>
          </button>
          {snackOpen && (
            <div className="mt-4 space-y-3 pt-3 border-t border-zinc-100">
              <SnackLabelScanner
                onApplyPerPiece={(perPiece) => setSnackPerPiece(perPiece)}
              />
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
                className={`w-full bg-[#7ED321] text-white font-medium py-3 rounded-xl ${btnClass}`}
              >
                套用總卡路里
              </button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-800">手動調整營養素</h2>
            {macrosFromSearch && calories > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                來自 AI 搜尋
              </span>
            )}
          </div>
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
          disabled={saveLoading || imageCompressing}
          className={`w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg text-lg disabled:opacity-60 ${btnClass}`}
        >
          {saveLoading
            ? macrosFromSearch
              ? "正在儲存..."
              : "AI 正在火速分析..."
            : imageCompressing
              ? "壓縮相片中..."
              : t("addMeal.publish", "發布記錄")}
        </button>
      </main>
    </div>
  );
}
