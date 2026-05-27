export type ThemeColor = "emerald" | "blue" | "black";

export interface UserProfile {
  targetCalories: number;
  targetProtein: number;
}

export interface CoachBranding {
  appTitle: string;
  themeColor: ThemeColor;
}

export interface MealLog {
  id: string;
  date: string;
  mealType: string;
  description: string;
  imageBase64?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  createdAt: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  targetCalories: 2000,
  targetProtein: 120,
};

export const DEFAULT_BRANDING: CoachBranding = {
  appTitle: "健身飲食追蹤",
  themeColor: "emerald",
};
