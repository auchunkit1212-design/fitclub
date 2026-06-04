"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdvancedNutritionCard } from "@/components/AdvancedNutritionCard";
import { FoodSearchEngine } from "@/components/FoodSearchEngine";
import { useI18n } from "@/components/I18nProvider";
import { OnboardingModal } from "@/components/OnboardingModal";
import { NutritionDashboard } from "@/components/NutritionDashboard";
import { PageHeader } from "@/components/PageHeader";
import { SnackLabelScanner } from "@/components/SnackLabelScanner";
import { BarChart2, Camera, Cookie, Globe, IconLabel } from "@/components/icons";
import { publishMealSharePost } from "@/lib/community";
import { estimateMacrosWithBreakdown } from "@/lib/ai-mock";
import { formatCompositeBreakdown } from "@/lib/composite-meal";
import {
  estimateMilkMacros,
  isMilkLikeDescription,
  parseVolumeMl,
} from "@/lib/macro-scale";
import {
  CARBS_PORTION_KEYS,
  MEAL_TYPE_KEYS,
  PROTEIN_PORTION_KEYS,
  carbsPortionKeyToLegacy,
  proteinPortionKeyToLegacy,
  veggiesKeyToLegacy,
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
import { uploadMealImageFromClient } from "@/lib/meal-image-storage";
import { initUserRegistry } from "@/lib/registry";
import { getSession, saveSession, getSessionRequestHeaders } from "@/lib/session";
import { errorMessage } from "@/lib/errors";
import { getSupabasePublicEnvStatus } from "@/lib/supabase-env";
import { storePendingStreakMilestone } from "@/lib/streak";
import { getMealLogs, isToday, saveMealLog } from "@/lib/storage";
import type {
  FoodAdvancedNutrients,
  MealLog,
  StudentBodyProfile,
  UserSession,
} from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export default function AddMealPage() {
  const router = useRouter();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [searchAdvanced, setSearchAdvanced] = useState<
    FoodAdvancedNutrients | undefined
  >();
  const [proNutrition, setProNutrition] = useState(false);
  const [shareToCommunity, setShareToCommunity] = useState(false);

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

    let finalCalories = calories;
    let finalProtein = protein;
    let finalCarbs = carbs;
    let finalFats = fats;

    const descTrim = description.trim();
    const volumeMl = parseVolumeMl(descTrim);
    const milkOnly =
      isMilkLikeDescription(descTrim) &&
      (volumeMl != null || !macrosFromSearch) &&
      !descTrim.includes("+") &&
      !descTrim.includes("、");

    if (milkOnly) {
      const milkEst = estimateMilkMacros(volumeMl ?? 250);
      finalCalories = milkEst.calories;
      finalProtein = milkEst.protein;
      finalCarbs = milkEst.carbs;
      finalFats = milkEst.fats;
      setCalories(milkEst.calories);
      setProtein(milkEst.protein);
      setCarbs(milkEst.carbs);
      setFats(milkEst.fats);
    } else if (macrosFromSearch && calories > 0) {
      // 食物搜尋已帶入營養
    } else {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const result = estimateMacrosWithBreakdown(
        descTrim,
        carbsPortionKeyToLegacy(carbsPortionKey),
        proteinPortionKeyToLegacy(proteinPortionKey),
        veggiesKeyToLegacy(hasVeggies)
      );
      finalCalories = result.macros.calories;
      finalProtein = result.macros.protein;
      finalCarbs = result.macros.carbs;
      finalFats = result.macros.fats;
      setCalories(result.macros.calories);
      setProtein(result.macros.protein);
      setCarbs(result.macros.carbs);
      setFats(result.macros.fats);
      if (result.isComposite && result.parts.length > 0) {
        alert(
          `已智能分拆 ${result.parts.length} 樣食物：\n${formatCompositeBreakdown(result.parts)}\n\n合計 ${result.macros.calories} kcal`
        );
      }
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

    const mealTypeLabel = t(`addMeal.mealTypes.${mealTypeKey}`, mealTypeKey);

    const basePayload = {
      email,
      mealType: mealTypeLabel,
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
      await saveMealLog({ ...mealPayload, imageUrl }, { notifyCoach: true });
    };

    const finishAfterSave = async (imageUrl?: string) => {
      if (shareToCommunity && currentSession) {
        try {
          publishMealSharePost({
            session: currentSession,
            mealType: mealTypeLabel,
            description: basePayload.description,
            calories: finalCalories,
            protein: finalProtein,
            carbs: finalCarbs,
            fats: finalFats,
            imageUrl: imageUrl ?? uploadedImageUrl,
          });
        } catch (shareErr) {
          console.warn("[add-meal] community share failed", shareErr);
        }
      }
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
        try {
          const streakRes = await fetch("/api/student/streak", {
            method: "POST",
            credentials: "include",
            headers: getSessionRequestHeaders(),
          });
          if (streakRes.ok) {
            const streakData = (await streakRes.json()) as {
              streak?: { milestoneTriggered?: boolean; milestoneDays?: number };
            };
            if (
              streakData.streak?.milestoneTriggered &&
              streakData.streak.milestoneDays &&
              [3, 7, 14, 30].includes(streakData.streak.milestoneDays)
            ) {
              storePendingStreakMilestone(
                streakData.streak.milestoneDays as 3 | 7 | 14 | 30
              );
            }
          }
        } catch {
          // streak optional
        }
        await finishAfterSave(imageUrl);
        router.push(shareToCommunity ? "/community" : "/");
        return;
      }

      if (res.ok) {
        try {
          const okData = (await res.json()) as {
            streak?: {
              milestoneTriggered?: boolean;
              milestoneDays?: number;
            };
          };
          if (
            okData.streak?.milestoneTriggered &&
            okData.streak.milestoneDays &&
            [3, 7, 14, 30].includes(okData.streak.milestoneDays)
          ) {
            storePendingStreakMilestone(
              okData.streak.milestoneDays as 3 | 7 | 14 | 30
            );
          }
        } catch {
          // ignore parse
        }
        await finishAfterSave(imageUrl);
        router.push(shareToCommunity ? "/community" : "/");
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
        try {
          const streakRes = await fetch("/api/student/streak", {
            method: "POST",
            credentials: "include",
            headers: getSessionRequestHeaders(),
          });
          if (streakRes.ok) {
            const streakData = (await streakRes.json()) as {
              streak?: { milestoneTriggered?: boolean; milestoneDays?: number };
            };
            if (
              streakData.streak?.milestoneTriggered &&
              streakData.streak.milestoneDays &&
              [3, 7, 14, 30].includes(streakData.streak.milestoneDays)
            ) {
              storePendingStreakMilestone(
                streakData.streak.milestoneDays as 3 | 7 | 14 | 30
              );
            }
          }
        } catch {
          // streak optional
        }
        await finishAfterSave(imageUrl);
        router.push(shareToCommunity ? "/community" : "/");
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
            setSearchAdvanced(item.advanced);
            setProNutrition(Boolean(item.proNutrition));
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
                setSearchAdvanced(undefined);
                setProNutrition(false);
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
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3 shadow-sm">
          <h2 className="font-semibold text-zinc-800">
            {t("addMeal.quickPortion", "快速份量估算")}
          </h2>
          <p className="text-xs text-zinc-500">
            {t("addMeal.quickPortionHint", "AI 已啟用外食隱形熱量修正（湯底、紅油、用油）")}
          </p>
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
            {t("addMeal.autoEstimateHint", "儲存時會自動 AI 估算熱量同 Macros（無需再撳下面掣）")}
          </p>
        </section>

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
            ? macrosFromSearch
              ? t("addMeal.saving", "正在儲存...")
              : t("addMeal.aiAnalyzing", "AI 正在火速分析...")
            : imageCompressing
              ? t("addMeal.compressingPhoto", "壓縮相片中...")
              : t("addMeal.publish", "發布記錄")}
        </button>
      </main>
    </div>
  );
}
