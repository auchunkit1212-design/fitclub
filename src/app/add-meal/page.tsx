"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdvancedNutritionCard } from "@/components/AdvancedNutritionCard";
import { FoodSearchEngine } from "@/components/FoodSearchEngine";
import { ServingPortionPicker } from "@/components/ServingPortionPicker";
import { useI18n } from "@/components/I18nProvider";
import { MultiFoodPortionPanel, type MultiFoodTotals } from "@/components/MultiFoodPortionPanel";
import { NutritionLabelOcrButton } from "@/components/NutritionLabelOcrButton";
import { OnboardingModal } from "@/components/OnboardingModal";
import { NutritionDashboard } from "@/components/NutritionDashboard";
import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";
import { SnackLabelScanner } from "@/components/SnackLabelScanner";
import { BarChart2, Camera, Cookie, Globe, IconLabel, Loader2, Sparkles } from "@/components/icons";
import { publishMealSharePostCloud } from "@/lib/community-client";
import { estimateMealNutritionClient } from "@/lib/meal-estimate-client";
import {
  CARBS_PORTION_KEYS,
  MEAL_TYPE_KEYS,
  PROTEIN_PORTION_KEYS,
  type CarbsPortionKey,
  type MealTypeKey,
  type ProteinPortionKey,
} from "@/lib/portion-estimate";
import {
  computeTargetProfile,
  isBodyProfileComplete,
} from "@/lib/body-profile";
import {
  fetchStudentBodyProfile,
  fetchUsersForSession,
} from "@/lib/db";
import { compressDataUrl, compressFileImage } from "@/lib/image";
import type { OcrNutritionResult } from "@/lib/ocr-nutrition";
import type { MealBaselineSource } from "@/lib/meal-ai-verify";
import {
  scaleAdvancedNutrients,
  scaleMacros,
} from "@/lib/portion-scale";
import { uploadMealImageFromClient } from "@/lib/meal-image-storage";
import { initUserRegistry } from "@/lib/registry";
import { getSession, saveSession, getSessionRequestHeaders } from "@/lib/session";
import { errorMessage } from "@/lib/errors";
import { getSupabasePublicEnvStatus } from "@/lib/supabase-env";
import { storePendingStreakMilestone } from "@/lib/streak";
import { getMealLogs, getOwnMealLogs, isToday } from "@/lib/storage";
import { detectMealFoodsFromPhoto } from "@/lib/meal-photo-detect-client";
import type { DetectedMealFood } from "@/lib/meal-photo-detect";
import { saveMealViaApi } from "@/lib/meal-save-client";
import type {
  FoodAdvancedNutrients,
  MealLog,
  StudentBodyProfile,
  UserSession,
} from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

function buildMealDescriptionWithPortions(
  description: string,
  carbsPortionKey: CarbsPortionKey,
  proteinPortionKey: ProteinPortionKey,
  hasVeggies: boolean,
  t: (key: string, fallback?: string) => string
): string {
  const base = description.trim();
  if (!base) return base;

  const hints: string[] = [];
  if (carbsPortionKey !== "none") {
    hints.push(
      `澱粉${t(`addMeal.portions.${carbsPortionKey}`, carbsPortionKey)}`
    );
  }
  if (proteinPortionKey !== "none") {
    hints.push(
      `蛋白${t(`addMeal.portions.${proteinPortionKey}`, proteinPortionKey)}`
    );
  }
  hints.push(hasVeggies ? "有蔬菜" : "無蔬菜");

  return `${base}（${hints.join("；")}）`;
}

function AddMealPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fromCoach = searchParams.get("from") === "coach";

  const [mealTypeKey, setMealTypeKey] = useState<MealTypeKey>("lunch");
  const [description, setDescription] = useState("");
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [carbsPortionKey, setCarbsPortionKey] = useState<CarbsPortionKey>("carbsMedium");
  const [proteinPortionKey, setProteinPortionKey] =
    useState<ProteinPortionKey>("proteinMedium");
  const [hasVeggies, setHasVeggies] = useState(true);
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
  const [macrosLockedFromPicker, setMacrosLockedFromPicker] = useState(false);
  const [searchAdvanced, setSearchAdvanced] = useState<
    FoodAdvancedNutrients | undefined
  >();
  const [proNutrition, setProNutrition] = useState(false);
  const [nutritionSource, setNutritionSource] = useState<
    MealBaselineSource | undefined
  >();
  const [shareToCommunity, setShareToCommunity] = useState(false);
  const [ocrPortionBase, setOcrPortionBase] = useState<{
    productName: string;
    macros: { calories: number; protein: number; carbs: number; fats: number };
    advanced?: FoodAdvancedNutrients;
    baseWeightG?: number;
    proNutrition?: boolean;
  } | null>(null);
  const [detectedFoods, setDetectedFoods] = useState<DetectedMealFood[]>([]);
  const [foodDetecting, setFoodDetecting] = useState(false);
  const [multiFoodMode, setMultiFoodMode] = useState(false);
  const [foodDetectError, setFoodDetectError] = useState("");
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiEstimateError, setAiEstimateError] = useState("");

  const applyOcrPortionedNutrition = useCallback(
    (ratio: number, _portionLabel: string, description: string) => {
      if (!ocrPortionBase) return;
      const scaled = scaleMacros(ocrPortionBase.macros, ratio);
      const scaledAdvanced = scaleAdvancedNutrients(
        ocrPortionBase.advanced,
        ratio
      );
      setDescription(description);
      setCalories(scaled.calories);
      setProtein(scaled.protein);
      setCarbs(scaled.carbs);
      setFats(scaled.fats);
      setSearchAdvanced(scaledAdvanced);
      setMacrosFromSearch(true);
      setProNutrition(Boolean(ocrPortionBase.proNutrition));
    },
    [ocrPortionBase]
  );

  const clearMultiFoodDetection = useCallback(() => {
    setDetectedFoods([]);
    setMultiFoodMode(false);
    setFoodDetectError("");
  }, []);

  const applyMultiFoodTotals = useCallback((totals: MultiFoodTotals) => {
    setDescription(totals.description);
    setCalories(totals.calories);
    setProtein(totals.protein);
    setCarbs(totals.carbs);
    setFats(totals.fats);
    setMacrosFromSearch(true);
    setNutritionSource("openrouter");
    setOcrPortionBase(null);
    setSearchAdvanced(undefined);
    setProNutrition(false);
  }, []);

  const runFoodDetection = useCallback(
    async (imageData: string) => {
      setFoodDetecting(true);
      setFoodDetectError("");
      clearMultiFoodDetection();

      const result = await detectMealFoodsFromPhoto(imageData, lang);
      if (!result.ok || !result.foods.length) {
        setFoodDetectError(
          !result.ok
            ? result.error
            : t(
                "addMeal.errors.foodDetectFailed",
                "AI 未能分拆食物，請手動輸入描述同份量。"
              )
        );
        setFoodDetecting(false);
        return;
      }

      setDetectedFoods(result.foods);
      setMultiFoodMode(true);
      setFoodDetecting(false);
    },
    [clearMultiFoodDetection, lang, t]
  );

  const handleOcrSuccess = (v: OcrNutritionResult) => {
    clearMultiFoodDetection();
    const productName =
      v.brand && v.productName
        ? `${v.brand} ${v.productName}`.trim()
        : v.productName;
    setOcrPortionBase({
      productName,
      macros: {
        calories: v.calories,
        protein: v.protein,
        carbs: v.carbs,
        fats: v.fat,
      },
      advanced: {
        sodiumMg: v.sodium > 0 ? v.sodium : undefined,
        sugarG: v.sugar > 0 ? v.sugar : undefined,
      },
      baseWeightG: v.servingWeightG > 0 ? v.servingWeightG : undefined,
      proNutrition: v.sodium > 0 || v.sugar > 0,
    });
    setMacrosFromSearch(true);
    setProNutrition(v.sodium > 0 || v.sugar > 0);
    setNutritionSource("ocr");
  };

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
        const isCoachSelf =
          fromCoach &&
          (active.role === "coach" || active.role === "admin");
        const logs = isCoachSelf
          ? await getOwnMealLogs(active)
          : await getMealLogs(active, registry);
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
  }, [router, fromCoach]);

  useEffect(() => {
    if (
      multiFoodMode ||
      macrosLockedFromPicker ||
      ocrPortionBase ||
      !description.trim() ||
      description.trim().length < 2
    ) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setAiEstimating(true);
        setAiEstimateError("");
        try {
          const descForAi = buildMealDescriptionWithPortions(
            description,
            carbsPortionKey,
            proteinPortionKey,
            hasVeggies,
            t
          );
          const result = await estimateMealNutritionClient({
            description: descForAi,
            imageBase64,
            baseline:
              calories > 0
                ? { calories, protein, carbs, fats }
                : undefined,
            baselineSource: nutritionSource,
            advanced: searchAdvanced,
          });
          if (cancelled) return;
          setCalories(result.macros.calories);
          setProtein(result.macros.protein);
          setCarbs(result.macros.carbs);
          setFats(result.macros.fats);
          setNutritionSource("openrouter");
        } catch (err) {
          if (!cancelled) {
            setAiEstimateError(
              err instanceof Error ? err.message : t("addMeal.errors.aiEstimateFailed", "AI 估算失敗")
            );
          }
        } finally {
          if (!cancelled) setAiEstimating(false);
        }
      })();
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    description,
    carbsPortionKey,
    proteinPortionKey,
    hasVeggies,
    imageBase64,
    multiFoodMode,
    macrosLockedFromPicker,
    ocrPortionBase,
    calories,
    protein,
    carbs,
    fats,
    nutritionSource,
    searchAdvanced,
    t,
  ]);

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
      void runFoodDetection(compressed);
      setFoodDetectError("");
    } catch (err) {
      console.error("[add-meal] image compress failed", err);
      alert(t("addMeal.errors.compressFailed", "相片壓縮失敗，請換一張較細的相片或再試一次。"));
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
      alert(t("addMeal.errors.descriptionRequired", "請填寫食物描述！"));
      return;
    }
    if (saveLoading) return;

    const email = readSessionEmail();
    if (!email) {
      alert(t("addMeal.errors.loginRequired", "請先登入再記錄飲食。"));
      router.push("/register");
      return;
    }

    setSaveLoading(true);

    const currentSession = getSession();
    if (currentSession) saveSession(currentSession);

    const descTrim = description.trim();
    const descForAi = multiFoodMode
      ? descTrim
      : buildMealDescriptionWithPortions(
          descTrim,
          carbsPortionKey,
          proteinPortionKey,
          hasVeggies,
          t
        );

    const finalCalories = calories;
    const finalProtein = protein;
    const finalCarbs = carbs;
    const finalFats = fats;
    const verifySource = nutritionSource ?? "openrouter";

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

    const mealTypeLabel = t(`addMeal.mealTypes.${mealTypeKey}`, mealTypeKey);

    const mealPayload = {
      email,
      mealType: mealTypeLabel,
      description: descForAi,
      calories: finalCalories,
      protein: finalProtein,
      carbs: finalCarbs,
      fats: finalFats,
    };

    const finishAfterSave = async (
      saved: {
        description: string;
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
      },
      imageUrl?: string
    ) => {
      if (shareToCommunity && currentSession) {
        try {
          await publishMealSharePostCloud({
            session: currentSession,
            mealType: mealTypeLabel,
            description: saved.description,
            calories: saved.calories,
            protein: saved.protein,
            carbs: saved.carbs,
            fats: saved.fats,
            imageUrl: imageUrl ?? uploadedImageUrl,
          });
        } catch (shareErr) {
          console.warn("[add-meal] community share failed", shareErr);
        }
      }
    };

    try {
      const result = await saveMealViaApi({
        ...mealPayload,
        imageUrl: uploadedImageUrl,
        imageBase64: imageToUpload,
        nutritionSource: verifySource,
        advanced: searchAdvanced,
      });

      if (
        result.streak?.milestoneTriggered &&
        result.streak.milestoneDays &&
        [3, 7, 14, 30].includes(result.streak.milestoneDays)
      ) {
        storePendingStreakMilestone(
          result.streak.milestoneDays as 3 | 7 | 14 | 30
        );
      }

      await finishAfterSave(result.log, uploadedImageUrl);

      if (result.nutritionVerified?.adjusted) {
        const note = result.nutritionVerified.note?.trim();
        alert(
          note
            ? t("addMeal.aiAdjusted", "AI 已覆核並修正營養：{note}", { note })
            : t(
                "addMeal.aiAdjustedShort",
                "AI 已覆核並修正營養數值後儲存。"
              )
        );
      }

      const homePath = fromCoach ? "/coach" : "/";
      router.push(shareToCommunity ? "/community" : homePath);
    } catch (err) {
      console.error("[add-meal] save failed", err);
      alert(errorMessage(err, t("addMeal.errors.saveFailed", "儲存失敗，請稍後再試")));
    } finally {
      setSaveLoading(false);
    }
  };

  if (!profileChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        {t("common.loading", "載入中...")}
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
    <div
      className={`min-h-screen bg-white max-w-lg mx-auto ${
        fromCoach && (session?.role === "coach" || session?.role === "admin")
          ? "pb-32"
          : "pb-safe"
      }`}
    >
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
        onBack={() => router.push(fromCoach ? "/coach" : "/")}
        backLabel={t("header.back", "← 返回")}
      />

      <main className="px-4 py-4 space-y-4">
        <button
          type="button"
          onClick={() => setShowNutritionDash(true)}
          className={`w-full bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-md ${btnClass}`}
        >
          <IconLabel icon={BarChart2} size="md" className="justify-center" iconClassName="text-white">
            {t("addMeal.advancedNutrition", "高級營養分析")}
          </IconLabel>
        </button>

        <FoodSearchEngine
          onAddToMeal={(item) => {
            setDescription(item.description);
            setCalories(item.calories);
            setProtein(item.protein);
            setCarbs(item.carbs);
            setFats(item.fats);
            setMacrosFromSearch(item.fromSearch);
            setMacrosLockedFromPicker(item.fromSearch);
            setSearchAdvanced(item.advanced);
            setProNutrition(Boolean(item.proNutrition));
            setNutritionSource(item.nutritionSource);
            setOcrPortionBase(null);
            clearMultiFoodDetection();
          }}
        />

        {calories > 0 && (
          <AdvancedNutritionCard
            name={description.trim() || undefined}
            macros={{ calories, protein, carbs, fats }}
            advanced={searchAdvanced}
            proSource={proNutrition}
          />
        )}

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t("addMeal.mealType", "餐別")}
            </label>
            <select
              value={mealTypeKey}
              onChange={(e) => setMealTypeKey(e.target.value as MealTypeKey)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base bg-white"
            >
              {MEAL_TYPE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`addMeal.mealTypes.${key}`, key)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t("addMeal.description", "食物描述")}
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setMacrosFromSearch(false);
                setMacrosLockedFromPicker(false);
                setSearchAdvanced(undefined);
                setProNutrition(false);
                setNutritionSource(undefined);
                setOcrPortionBase(null);
                clearMultiFoodDetection();
              }}
              placeholder={t(
                "addMeal.descriptionPlaceholder",
                "例如：牛肉叉燒拉麵、茶餐廳乾炒牛河..."
              )}
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
                <p className="text-zinc-600 font-medium">
                  {t("addMeal.compressingPhoto", "壓縮相片中...")}
                </p>
              ) : imageBase64 ? (
                <img
                  src={imageBase64}
                  alt={t("addMeal.uploadedPhotoAlt", "已上傳食物")}
                  className="max-h-40 mx-auto rounded-xl object-contain"
                />
              ) : (
                <p className="text-zinc-500 flex items-center justify-center gap-2">
                  <Camera size={20} strokeWidth={2} className="shrink-0 text-zinc-400" aria-hidden />
                  {t("addMeal.uploadPhotoHint", "撳一下拍照或選擇相片（自動壓縮至 1MB 內）")}
                </p>
              )}
            </div>
            {imageBase64 ? (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  disabled={foodDetecting}
                  onClick={() => void runFoodDetection(imageBase64)}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-800 ${btnClass} disabled:opacity-60`}
                >
                  {foodDetecting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                      {t("addMeal.detectingFoods", "AI 分拆食物緊...")}
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} aria-hidden />
                      {t("addMeal.detectFoods", "AI 分拆相片入面嘅食物")}
                    </>
                  )}
                </button>
                {foodDetectError ? (
                  <p className="text-xs text-amber-700">{foodDetectError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {multiFoodMode && detectedFoods.length > 0 ? (
          <section className="bg-white rounded-2xl border border-violet-100 p-4 shadow-sm">
            <MultiFoodPortionPanel
              foods={detectedFoods}
              onTotalsChange={applyMultiFoodTotals}
            />
          </section>
        ) : null}

        {!multiFoodMode ? (
        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
          <h2 className="font-semibold text-zinc-800">
            {t("addMeal.quickPortion", "快速份量估算")}
          </h2>
          <p className="text-xs text-zinc-500">
            {t(
              "addMeal.quickPortionHint",
              "選好份量後會由 AI 估算熱量（含外食隱形熱量：湯底、紅油、用油）"
            )}
          </p>
          {aiEstimating ? (
            <p className="text-xs text-violet-600 font-medium">
              {t("addMeal.aiEstimating", "AI 估算緊...")}
            </p>
          ) : null}
          {aiEstimateError ? (
            <p className="text-xs text-amber-700">{aiEstimateError}</p>
          ) : null}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-zinc-500">
                {t("addMeal.carbsPortion", "碳水（拳頭大小）")}
              </label>
              <select
                value={carbsPortionKey}
                onChange={(e) => setCarbsPortionKey(e.target.value as CarbsPortionKey)}
                className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                {CARBS_PORTION_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`addMeal.portions.${key}`, key)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">
                {t("addMeal.proteinPortion", "蛋白質（手掌大小）")}
              </label>
              <select
                value={proteinPortionKey}
                onChange={(e) =>
                  setProteinPortionKey(e.target.value as ProteinPortionKey)
                }
                className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                {PROTEIN_PORTION_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`addMeal.portions.${key}`, key)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">
                {t("addMeal.veggies", "蔬菜")}
              </label>
              <select
                value={hasVeggies ? "yes" : "none"}
                onChange={(e) => setHasVeggies(e.target.value === "yes")}
                className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
              >
                <option value="none">{t("addMeal.portions.none", "無 / 冇食 (0)")}</option>
                <option value="yes">{t("common.yes", "有")}</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            {t(
              "addMeal.autoEstimateHint",
              "儲存前會由 AI 覆核所有營養數值（有相片會一併分析）"
            )}
          </p>
        </section>
        ) : null}

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setSnackOpen(!snackOpen)}
            className={`w-full flex justify-between items-center font-semibold text-zinc-800 ${btnClass}`}
          >
            <IconLabel icon={Cookie} iconClassName="text-zinc-700">
              {t("addMeal.calculateCalories", "計算卡路里")}
            </IconLabel>
            <span className="text-zinc-400">{snackOpen ? "▲" : "▼"}</span>
          </button>
          {snackOpen && (
            <div className="mt-4 space-y-3 pt-3 border-t border-zinc-100">
              <SnackLabelScanner
                onApplyPerPiece={(perPiece) => setSnackPerPiece(perPiece)}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500">
                    {t("addMeal.perPieceCalories", "每件卡路里")}
                  </label>
                  <input
                    type="number"
                    value={snackPerPiece}
                    onChange={(e) => setSnackPerPiece(Number(e.target.value))}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500">
                    {t("common.quantity", "數量")}
                  </label>
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
                {t("common.total", "總計")}: {snackPerPiece * snackQty} kcal
              </p>
              <button
                type="button"
                onClick={applySnackTotal}
                className={`w-full bg-emerald-600 text-white font-medium py-3 rounded-xl ${btnClass}`}
              >
                {t("addMeal.applyTotalCalories", "套用總卡路里")}
              </button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-800">
              {t("addMeal.manualMacros", "手動調整營養素")}
            </h2>
            {macrosFromSearch && calories > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                {t("addMeal.fromAiSearch", "來自 AI 搜尋")}
              </span>
            )}
          </div>
          <NutritionLabelOcrButton onSuccess={handleOcrSuccess} />
          {ocrPortionBase && (
            <ServingPortionPicker
              baseWeightG={ocrPortionBase.baseWeightG}
              productName={ocrPortionBase.productName}
              onPortionChange={applyOcrPortionedNutrition}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                [t("addMeal.caloriesKcal", "熱量 (kcal)"), calories, setCalories],
                [t("addMeal.proteinG", "蛋白質 (g)"), protein, setProtein],
                [t("addMeal.carbsG", "碳水 (g)"), carbs, setCarbs],
                [t("addMeal.fatG", "脂肪 (g)"), fats, setFats],
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

        <section className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shareToCommunity}
              onChange={(e) => setShareToCommunity(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-800 text-sm">
                <Globe size={16} className="text-emerald-600 shrink-0" aria-hidden />
                {t("addMeal.shareToCommunity", "分享到 Community")}
              </span>
              <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">
                {t(
                  "addMeal.shareToCommunityHint",
                  "發布記錄後會將食物名稱、相片（如有）同 P/C/F 營養素顯示喺社群動態"
                )}
              </span>
            </span>
          </label>
        </section>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveLoading || imageCompressing}
          className={`w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg text-lg disabled:opacity-60 ${btnClass}`}
        >
          {saveLoading
            ? t("addMeal.aiVerifying", "AI 正在覆核營養...")
            : imageCompressing
              ? t("addMeal.compressingPhoto", "壓縮相片中...")
              : t("addMeal.publish", "發布記錄")}
        </button>
      </main>

      {(session?.role === "coach" || session?.role === "admin") && fromCoach && (
        <BottomNav
          role={session.role === "admin" ? "admin" : "coach"}
          onFabClick={() => router.push("/add-meal?from=coach")}
        />
      )}
    </div>
  );
}

export default function AddMealPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-zinc-500">
          載入中...
        </div>
      }
    >
      <AddMealPageContent />
    </Suspense>
  );
}
