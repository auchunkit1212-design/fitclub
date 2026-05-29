export type ThemeColor = "emerald" | "blue" | "black";

export interface UserProfile {
  targetCalories: number;
  targetProtein: number;
}

export interface CoachBranding {
  appTitle: string;
  themeColor: ThemeColor;
  logo?: string;
}

export interface RegistryUser {
  email: string;
  name: string;
  role: "student" | "coach";
  gym: string;
  coach?: string;
  addedBy?: string;
  logo?: string;
  appTitle?: string;
  themeColor?: ThemeColor;
  broadcast?: string;
}

export interface UserSession {
  role: "student" | "coach" | "admin";
  name: string;
  email: string;
  gym: string;
  coach?: string;
  addedBy?: string;
  isLoggedIn: boolean;
}

export interface MealLog {
  id: string;
  email: string;
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
