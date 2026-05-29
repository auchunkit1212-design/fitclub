export type ThemeColor = "emerald" | "blue" | "black";

export type StudentGender = "male" | "female" | "other";

export interface StudentBodyProfile {
  email: string;
  heightCm: number;
  weightKg: number;
  age: number;
  gender: StudentGender;
  targetWeightKg: number;
  exerciseCaloriesDaily: number;
  onboardingComplete: boolean;
  updatedAt?: string;
}

export interface UserProfile {
  targetCalories: number;
  targetProtein: number;
}

export interface CoachBranding {
  appTitle: string;
  themeColor: ThemeColor;
  logo?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  gymName: string;
  logoUrl?: string;
  ownerEmail: string;
  plan: string;
}

export interface RegistryUser {
  email: string;
  name: string;
  role: "student" | "coach";
  gym: string;
  coach?: string;
  addedBy?: string;
  tenantId?: string;
  logo?: string;
  appTitle?: string;
  themeColor?: ThemeColor;
  broadcast?: string;
  hasPassword?: boolean;
  /** 僅伺服器登入驗證用，切勿傳去前端 */
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
  tenantSlug?: string;
  brandName?: string;
  brandLogo?: string;
  isLoggedIn: boolean;
}

export interface MealLog {
  id: string;
  email: string;
  date: string;
  mealType: string;
  description: string;
  imageBase64?: string;
  /** Supabase Storage 公開 URL（bucket: food-images） */
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  createdAt: string;
}

export interface StudentNutritionTargets {
  studentEmail: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
  locked: boolean;
  setByCoachEmail?: string;
  updatedAt?: string;
}

export interface MealLogReaction {
  id: string;
  mealLogId: string;
  coachEmail: string;
  sticker: string;
  createdAt: string;
}

export interface FavoriteFood {
  id: string;
  studentEmail: string;
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingLabel: string;
  useCount: number;
  lastUsedAt: string;
}

export interface FoodSearchItem {
  id: string;
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingLabel: string;
  source: "edamam" | "mock";
}

export const DEFAULT_PROFILE: UserProfile = {
  targetCalories: 2000,
  targetProtein: 120,
};

export const DEFAULT_BRANDING: CoachBranding = {
  appTitle: "健康管理",
  themeColor: "emerald",
};

export const DEFAULT_GYM_NAME = "您的健身房";
