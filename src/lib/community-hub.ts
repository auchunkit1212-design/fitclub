import type { LucideIcon } from "lucide-react";
import { Flame, Scale, ShoppingCart, Sparkles, UtensilsCrossed } from "lucide-react";

export type CommunityHubItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  badge?: string;
  /** In-app route; omit for coming-soon tiles */
  href?: string;
  comingSoon?: boolean;
};

export const COMMUNITY_HUB_ITEMS: CommunityHubItem[] = [
  {
    id: "inbody-scan",
    title: "InBody 影相分析",
    subtitle: "自動讀體脂同肌肉進度",
    icon: Scale,
    accent: "from-sky-50 to-cyan-50 border-sky-100",
    badge: "New",
    href: "/profile",
  },
  {
    id: "coach-suggest",
    title: "教練！食咩好？",
    subtitle: "按剩餘宏量配餐",
    icon: UtensilsCrossed,
    accent: "from-emerald-50 to-teal-50 border-emerald-100",
    href: "/",
  },
  {
    id: "fat-loss-challenge",
    title: "減脂挑戰賽",
    subtitle: "每月排行榜，一齊打卡",
    icon: Flame,
    accent: "from-orange-50 to-amber-50 border-amber-100",
    badge: "New",
    href: "/leaderboard",
  },
  {
    id: "smart-grocery",
    title: "智能買餸清單",
    subtitle: "依目標自動建議",
    icon: ShoppingCart,
    accent: "from-lime-50 to-green-50 border-lime-100",
    comingSoon: true,
  },
  {
    id: "nutrition-quiz",
    title: "營養小測驗",
    subtitle: "玩住學宏量",
    icon: Sparkles,
    accent: "from-violet-50 to-indigo-50 border-violet-100",
    comingSoon: true,
  },
];
