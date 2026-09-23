"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/api-client";
import {
  ALLERGEN_OPTIONS,
  CUISINE_OPTIONS,
  DIET_STYLE_OPTIONS,
  MEDICAL_FLAG_OPTIONS,
  type CookingScene,
  type GoalType,
  type MealSchedule,
  type StudentBodyProfile,
  type StudentGender,
  type WeightChangeKgPerWeek,
  type WteDietProfile,
} from "@/lib/types";
import { WEIGHT_CHANGE_PACE_OPTIONS } from "@/lib/body-profile";
import { getSession } from "@/lib/session";

const STEPS = 6;

const SCENE_OPTS: CookingScene[] = [
  "home",
  "takeout",
  "convenience",
  "canteen",
];

function toggleIn<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value];
}

export default function OnboardingPage() {
  const { tt, lang } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [targetWeightKg, setTargetWeightKg] = useState(65);
  const [age, setAge] = useState(30);
  const [gender, setGender] = useState<StudentGender>("male");
  const [pace, setPace] = useState<WeightChangeKgPerWeek>(-0.5);
  const [goalType, setGoalType] = useState<GoalType>("cut");
  const [job, setJob] = useState("sedentary");
  const [weeklyFrequency, setWeeklyFrequency] = useState("1-2");
  const [mealSchedule, setMealSchedule] =
    useState<MealSchedule>("threeMeals");
  const [cookingScenes, setCookingScenes] = useState<CookingScene[]>([
    "home",
    "takeout",
  ]);
  const [dietStyles, setDietStyles] = useState<string[]>(["none"]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [cuisinePrefs, setCuisinePrefs] = useState<string[]>(["cantonese"]);
  const [disliked, setDisliked] = useState("");
  const [proteinPriority, setProteinPriority] = useState<"high" | "normal">(
    "high"
  );
  const [proteinSources, setProteinSources] = useState("雞胸, 蛋, 魚");
  const [medicalFlags, setMedicalFlags] = useState<string[]>(["none"]);
  const [disclaimer, setDisclaimer] = useState(false);
  const [calorieMode, setCalorieMode] = useState<"auto" | "manual">("auto");
  const [manualCal, setManualCal] = useState(2000);
  const [manualPro, setManualPro] = useState(140);
  const [preview, setPreview] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  } | null>(null);

  useEffect(() => {
    if (!getSession()?.email) {
      router.replace("/login");
      return;
    }
    void (async () => {
      const res = await apiFetch("/api/me/profile");
      if (!res.ok) {
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as {
        body?: StudentBodyProfile | null;
        diet?: WteDietProfile | null;
      };
      if (data.body) {
        setHeightCm(data.body.heightCm);
        setWeightKg(data.body.weightKg);
        setTargetWeightKg(data.body.targetWeightKg);
        setAge(data.body.age);
        setGender(data.body.gender);
        if (data.body.weightChangeKgPerWeek != null) {
          setPace(data.body.weightChangeKgPerWeek);
        }
      }
      if (data.diet) {
        setGoalType(data.diet.goalType);
        setJob(data.diet.job);
        setWeeklyFrequency(data.diet.weeklyFrequency);
        setMealSchedule(data.diet.mealSchedule);
        setCookingScenes(data.diet.cookingScenes);
        setDietStyles(data.diet.dietStyles.length ? data.diet.dietStyles : ["none"]);
        setAllergens(data.diet.allergens);
        setCuisinePrefs(
          data.diet.cuisinePrefs.length ? data.diet.cuisinePrefs : ["cantonese"]
        );
        setDisliked(data.diet.dislikedIngredients.join(", "));
        setProteinPriority(data.diet.proteinPriority);
        setProteinSources(data.diet.proteinSources.join(", "));
        setMedicalFlags(
          data.diet.medicalFlags.length ? data.diet.medicalFlags : ["none"]
        );
        setDisclaimer(data.diet.medicalDisclaimerAccepted);
        setCalorieMode(data.diet.calorieMode);
        setManualCal(data.diet.targets.calories);
        setManualPro(data.diet.targets.protein);
        setPreview(data.diet.targets);
      }
      setLoaded(true);
    })();
  }, [router]);

  const stepTitle = useMemo(() => {
    const keys = [
      "onboarding.stepBody",
      "onboarding.stepGoal",
      "onboarding.stepActivity",
      "onboarding.stepPrefs",
      "onboarding.stepProtein",
      "onboarding.stepTargets",
    ];
    return tt(keys[step]);
  }, [step, tt]);

  async function save(complete: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          body: {
            heightCm,
            weightKg,
            age,
            gender,
            targetWeightKg,
            weightChangeKgPerWeek: pace,
            exerciseCaloriesDaily: 0,
            onboardingComplete: true,
          },
          diet: {
            goalType,
            job,
            weeklyFrequency,
            mealSchedule,
            cookingScenes,
            dietStyles: dietStyles.filter((x) => x !== "none"),
            allergens,
            dislikedIngredients: disliked
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean),
            cuisinePrefs,
            proteinPriority,
            proteinSources: proteinSources
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean),
            medicalFlags: medicalFlags.filter((x) => x !== "none"),
            medicalDisclaimerAccepted: disclaimer,
            calorieMode,
            targets:
              calorieMode === "manual"
                ? {
                    calories: manualCal,
                    protein: manualPro,
                    carbs: Math.round(((manualCal - manualPro * 4) * 0.45) / 4),
                    fats: Math.round(((manualCal - manualPro * 4) * 0.55) / 9),
                  }
                : undefined,
            onboardingComplete: complete ? disclaimer : false,
          },
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        diet?: WteDietProfile;
      };
      if (!res.ok) {
        setError(data.error || tt("common.error"));
        return false;
      }
      if (data.diet?.targets) setPreview(data.diet.targets);
      return true;
    } catch {
      setError(tt("common.error"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onNext() {
    if (step < STEPS - 1) {
      if (step === STEPS - 2) {
        const ok = await save(false);
        if (!ok) return;
      }
      setStep((s) => s + 1);
      return;
    }
    if (!disclaimer) {
      setError(tt("onboarding.disclaimer"));
      return;
    }
    const ok = await save(true);
    if (ok) router.push("/");
  }

  if (!loaded) {
    return <p className="animate-plan-pulse text-ink-muted">{tt("common.loading")}</p>;
  }

  return (
    <section className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-3xl text-leaf-deep">
          {tt("onboarding.title")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {step + 1}/{STEPS} · {stepTitle}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-leaf transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div
        key={step}
        className="animate-wizard-slide space-y-4 rounded-2xl border border-ink/10 bg-white/75 p-5 backdrop-blur"
      >
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["height", heightCm, setHeightCm, tt("onboarding.height")],
                ["weight", weightKg, setWeightKg, tt("onboarding.weight")],
                [
                  "target",
                  targetWeightKg,
                  setTargetWeightKg,
                  tt("onboarding.targetWeight"),
                ],
                ["age", age, setAge, tt("onboarding.age")],
              ] as const
            ).map(([key, val, setVal, label]) => (
              <label key={key} className="text-sm">
                <span className="text-ink-soft">{label}</span>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => setVal(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-ink/15 bg-sand px-3 py-2"
                />
              </label>
            ))}
            <label className="col-span-2 text-sm">
              <span className="text-ink-soft">{tt("onboarding.gender")}</span>
              <div className="mt-2 flex gap-2">
                {(
                  [
                    ["male", "onboarding.male"],
                    ["female", "onboarding.female"],
                    ["other", "onboarding.other"],
                  ] as const
                ).map(([g, key]) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      gender === g
                        ? "bg-leaf text-white"
                        : "bg-sand text-ink-soft"
                    }`}
                  >
                    {tt(key)}
                  </button>
                ))}
              </div>
            </label>
          </div>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-ink-soft">{tt("onboarding.goalType")}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["cut", "onboarding.cut"],
                  ["bulk", "onboarding.bulk"],
                  ["maintain", "onboarding.maintain"],
                ] as const
              ).map(([g, key]) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGoalType(g);
                    if (g === "cut") setPace(-0.5);
                    if (g === "bulk") setPace(0.5);
                    if (g === "maintain") setPace(0);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    goalType === g ? "bg-leaf text-white" : "bg-sand"
                  }`}
                >
                  {tt(key)}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-soft">{tt("onboarding.pace")}</p>
            <div className="flex flex-col gap-2">
              {WEIGHT_CHANGE_PACE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPace(opt.value)}
                  className={`rounded-lg px-3 py-2 text-left text-sm ${
                    pace === opt.value ? "bg-leaf text-white" : "bg-sand"
                  }`}
                >
                  {tt(opt.i18nKey, opt.fallback)}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm">{tt("onboarding.job")}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["sedentary", "onboarding.jobSedentary"],
                  ["field", "onboarding.jobField"],
                  ["physical", "onboarding.jobPhysical"],
                ] as const
              ).map(([j, key]) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJob(j)}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    job === j ? "bg-leaf text-white" : "bg-sand"
                  }`}
                >
                  {tt(key)}
                </button>
              ))}
            </div>
            <label className="block text-sm">
              {tt("onboarding.freq")}
              <select
                value={weeklyFrequency}
                onChange={(e) => setWeeklyFrequency(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-sand px-3 py-2"
              >
                <option value="1-2">1–2</option>
                <option value="3">3</option>
                <option value="4-5">4–5</option>
                <option value="daily">Daily</option>
              </select>
            </label>
            <p className="text-sm">{tt("onboarding.mealSchedule")}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["threeMeals", "onboarding.threeMeals"],
                  ["fourMeals", "onboarding.fourMeals"],
                  ["fasting168", "onboarding.fasting168"],
                ] as const
              ).map(([m, key]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMealSchedule(m)}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    mealSchedule === m ? "bg-leaf text-white" : "bg-sand"
                  }`}
                >
                  {tt(key)}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <ChipGroup
              label={tt("onboarding.scenes")}
              options={SCENE_OPTS}
              selected={cookingScenes}
              onToggle={(v) =>
                setCookingScenes(toggleIn(cookingScenes, v as CookingScene))
              }
            />
            <ChipGroup
              label={tt("onboarding.styles")}
              options={[...DIET_STYLE_OPTIONS]}
              selected={dietStyles}
              onToggle={(v) => setDietStyles(toggleIn(dietStyles, v))}
            />
            <ChipGroup
              label={tt("onboarding.allergens")}
              options={[...ALLERGEN_OPTIONS]}
              selected={allergens}
              onToggle={(v) => setAllergens(toggleIn(allergens, v))}
            />
            <ChipGroup
              label={tt("onboarding.cuisines")}
              options={[...CUISINE_OPTIONS]}
              selected={cuisinePrefs}
              onToggle={(v) => setCuisinePrefs(toggleIn(cuisinePrefs, v))}
            />
            <label className="block text-sm">
              {tt("onboarding.disliked")}
              <input
                value={disliked}
                onChange={(e) => setDisliked(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-sand px-3 py-2"
              />
            </label>
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-sm">{tt("onboarding.proteinPriority")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProteinPriority("high")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  proteinPriority === "high" ? "bg-leaf text-white" : "bg-sand"
                }`}
              >
                {tt("onboarding.proteinHigh")}
              </button>
              <button
                type="button"
                onClick={() => setProteinPriority("normal")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  proteinPriority === "normal"
                    ? "bg-leaf text-white"
                    : "bg-sand"
                }`}
              >
                {tt("onboarding.proteinNormal")}
              </button>
            </div>
            <label className="block text-sm">
              {tt("onboarding.proteinSources")}
              <input
                value={proteinSources}
                onChange={(e) => setProteinSources(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-sand px-3 py-2"
              />
            </label>
            <ChipGroup
              label={tt("onboarding.medical")}
              options={[...MEDICAL_FLAG_OPTIONS]}
              selected={medicalFlags}
              onToggle={(v) => setMedicalFlags(toggleIn(medicalFlags, v))}
            />
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={disclaimer}
                onChange={(e) => setDisclaimer(e.target.checked)}
                className="mt-1"
              />
              <span>{tt("onboarding.disclaimer")}</span>
            </label>
          </>
        )}

        {step === 5 && (
          <>
            <p className="text-sm">{tt("onboarding.calorieMode")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCalorieMode("auto")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  calorieMode === "auto" ? "bg-leaf text-white" : "bg-sand"
                }`}
              >
                {tt("onboarding.auto")}
              </button>
              <button
                type="button"
                onClick={() => setCalorieMode("manual")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  calorieMode === "manual" ? "bg-leaf text-white" : "bg-sand"
                }`}
              >
                {tt("onboarding.manual")}
              </button>
            </div>
            {calorieMode === "manual" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  kcal
                  <input
                    type="number"
                    value={manualCal}
                    onChange={(e) => setManualCal(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-ink/15 bg-sand px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  protein
                  <input
                    type="number"
                    value={manualPro}
                    onChange={(e) => setManualPro(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-ink/15 bg-sand px-3 py-2"
                  />
                </label>
              </div>
            )}
            {preview && (
              <div className="rounded-xl bg-leaf-mist/60 p-4 text-sm">
                <p className="font-medium text-leaf-deep">
                  {tt("onboarding.targetsPreview")}
                </p>
                <p className="mt-2 text-ink">
                  {preview.calories} kcal · P {preview.protein}g · C{" "}
                  {preview.carbs}g · F {preview.fats}g
                </p>
              </div>
            )}
            <p className="text-xs text-ink-muted" lang={lang}>
              {tt("onboarding.disclaimer")}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-xl px-4 py-2.5 text-ink-soft disabled:opacity-40"
        >
          {tt("onboarding.back")}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onNext()}
          className="rounded-xl bg-leaf-deep px-5 py-2.5 text-white hover:bg-leaf disabled:opacity-60"
        >
          {saving
            ? tt("common.loading")
            : step === STEPS - 1
              ? tt("onboarding.finish")
              : tt("onboarding.next")}
        </button>
      </div>
    </section>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-ink-soft">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`rounded-lg px-2.5 py-1.5 text-xs ${
              selected.includes(opt)
                ? "bg-leaf text-white"
                : "bg-sand text-ink-soft"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
