export type StudentGender = "male" | "female" | "other";
export type WeightChangeKgPerWeek = -1 | -0.5 | 0 | 0.5 | 1;
export type UserPlan = "free" | "pro";

export interface StudentBodyProfile {
  email: string;
  heightCm: number;
  weightKg: number;
  age: number;
  gender: StudentGender;
  targetWeightKg: number;
  weightChangeKgPerWeek?: WeightChangeKgPerWeek | null;
  exerciseCaloriesDaily: number;
  onboardingComplete: boolean;
  updatedAt?: string;
}

export interface UserProfile {
  targetCalories: number;
  targetProtein: number;
}

export interface RegistryUser {
  email: string;
  name: string;
  role: "student" | "coach";
  plan?: UserPlan;
  gym: string;
  coach?: string;
  addedBy?: string;
  tenantId?: string;
  hasPassword?: boolean;
  passwordHash?: string;
}

export interface UserSession {
  role: "student" | "coach" | "admin";
  name: string;
  email: string;
  gym: string;
  coach?: string;
  addedBy?: string;
  tenantId?: string;
  plan?: UserPlan;
  isPro?: boolean;
  isLoggedIn: boolean;
}

export type GoalType = "cut" | "bulk" | "maintain";
export type MealSchedule = "threeMeals" | "fourMeals" | "fasting168";
export type CookingScene = "home" | "takeout" | "convenience" | "canteen";
export type ProteinPriority = "high" | "normal";
export type CalorieMode = "auto" | "manual";

export const DIET_STYLE_OPTIONS = [
  "keto",
  "low_carb",
  "vegetarian",
  "vegan",
  "halal",
  "none",
] as const;
export type DietStyle = (typeof DIET_STYLE_OPTIONS)[number];

export const ALLERGEN_OPTIONS = [
  "gluten",
  "dairy",
  "seafood",
  "peanut",
  "egg",
  "soy",
  "shellfish",
  "tree_nut",
] as const;
export type Allergen = (typeof ALLERGEN_OPTIONS)[number];

export const CUISINE_OPTIONS = [
  "cantonese",
  "japanese",
  "thai",
  "western",
  "korean",
  "taiwanese",
] as const;
export type CuisinePref = (typeof CUISINE_OPTIONS)[number];

export const MEDICAL_FLAG_OPTIONS = [
  "diabetes",
  "hypertension",
  "high_cholesterol",
  "gout",
  "none",
] as const;
export type MedicalFlag = (typeof MEDICAL_FLAG_OPTIONS)[number];

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface WteDietProfile {
  email: string;
  goalType: GoalType;
  job: string;
  weeklyFrequency: string;
  mealSchedule: MealSchedule;
  cookingScenes: CookingScene[];
  dietStyles: DietStyle[];
  allergens: Allergen[];
  dislikedIngredients: string[];
  cuisinePrefs: CuisinePref[];
  proteinPriority: ProteinPriority;
  proteinSources: string[];
  medicalFlags: MedicalFlag[];
  medicalDisclaimerAccepted: boolean;
  calorieMode: CalorieMode;
  targets: MacroTargets;
  onboardingComplete: boolean;
  updatedAt?: string;
}

export interface MealSlotOption {
  title: string;
  description: string;
  ingredients?: string[];
  steps?: string[];
}

export interface WeeklyMealSlot {
  slot: string;
  eat_out: MealSlotOption;
  cook: MealSlotOption;
  estimated_calories: number;
  protein_g: number;
}

export interface WeeklyPlanDay {
  /** YYYY-MM-DD */
  date: string;
  day_label: string;
  slots: WeeklyMealSlot[];
}

export interface WeeklyMealPlanPayload {
  summary_text: string;
  tags: string[];
  days: WeeklyPlanDay[];
  targets: MacroTargets;
}

export interface WteMealPlanRow {
  id: string;
  email: string;
  weekStart: string;
  payload: WeeklyMealPlanPayload;
  notes?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WteUsageRow {
  email: string;
  monthKey: string;
  generateCount: number;
  updatedAt: string;
}
