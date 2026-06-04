import type { LucideIcon } from "lucide-react";
import { Flame, ShoppingCart, Sparkles } from "lucide-react";

export type CommunityHubItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  badge?: string;
};

export const COMMUNITY_HUB_ITEMS: CommunityHubItem[] = [
  {
    id: "fat-loss-challenge",
    title: "減脂挑戰賽",
    subtitle: "即將開放",
    icon: Flame,
    accent: "from-orange-50 to-amber-50 border-amber-100",
    badge: "Soon",
  },
  {
    id: "smart-grocery",
    title: "智能買餸清單",
    subtitle: "依目標自動建議",
    icon: ShoppingCart,
    accent: "from-emerald-50 to-teal-50 border-emerald-100",
  },
  {
    id: "nutrition-quiz",
    title: "營養小測驗",
    subtitle: "玩住學宏量",
    icon: Sparkles,
    accent: "from-violet-50 to-indigo-50 border-violet-100",
  },
];

export type CommunityFeedPost = {
  id: string;
  authorName: string;
  authorInitials: string;
  avatarHue: string;
  postedAt: string;
  imageUrl: string;
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  likes: number;
};

export const COMMUNITY_FEED_MOCK: CommunityFeedPost[] = [
  {
    id: "feed-1",
    authorName: "阿 Ken",
    authorInitials: "K",
    avatarHue: "bg-sky-500",
    postedAt: "12 分鐘前",
    imageUrl:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
    mealName: "雞胸沙律碗",
    calories: 420,
    protein: 38,
    carbs: 32,
    fats: 14,
    likes: 24,
  },
  {
    id: "feed-2",
    authorName: "Mandy",
    authorInitials: "M",
    avatarHue: "bg-rose-400",
    postedAt: "1 小時前",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
    mealName: "瑪格麗特薄餅（兩片）",
    calories: 580,
    protein: 22,
    carbs: 68,
    fats: 24,
    likes: 11,
  },
  {
    id: "feed-3",
    authorName: "Jason 教練",
    authorInitials: "J",
    avatarHue: "bg-emerald-600",
    postedAt: "2 小時前",
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80",
    mealName: "高蛋白早餐盤",
    calories: 510,
    protein: 42,
    carbs: 28,
    fats: 22,
    likes: 56,
  },
  {
    id: "feed-4",
    authorName: "小芬",
    authorInitials: "芬",
    avatarHue: "bg-amber-500",
    postedAt: "3 小時前",
    imageUrl:
      "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80",
    mealName: "鮭魚藜麥飯",
    calories: 640,
    protein: 45,
    carbs: 52,
    fats: 26,
    likes: 33,
  },
];
