"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  Bell,
  Bot,
  Brain,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  HandMetal,
  Cookie,
  Copy,
  Cpu,
  Cuboid,
  Download,
  Dumbbell,
  Flame,
  GraduationCap,
  Hand,
  Heart,
  HeartPulse,
  Home,
  Leaf,
  Lightbulb,
  Link,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  Moon,
  Palette,
  Paperclip,
  PartyPopper,
  Plus,
  Rocket,
  Ruler,
  Salad,
  Scale,
  ScrollText,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Ticket,
  Users,
  UtensilsCrossed,
  Wrench,
  Zap,
  Droplets,
  LineChart,
} from "lucide-react";
import { normalizeStickerId, type MealStickerId } from "@/lib/meal-stickers";

export const iconSizes = { sm: 18, md: 20, lg: 24 } as const;

export type IconSizeKey = keyof typeof iconSizes;

export function iconPx(size: IconSizeKey | number = "md"): number {
  return typeof size === "number" ? size : iconSizes[size];
}

const stickerIconMap: Record<MealStickerId, LucideIcon> = {
  "thumbs-up": ThumbsUp,
  flame: Flame,
  dumbbell: Dumbbell,
  star: Star,
  target: Target,
  heart: Heart,
  clap: HandMetal,
  salad: Salad,
};

export const MEAL_STICKERS = (
  Object.entries(stickerIconMap) as [MealStickerId, LucideIcon][]
).map(([id, Icon]) => ({ id, Icon }));

export function MealStickerIcon({
  sticker,
  size = "md",
  className = "",
}: {
  sticker: string;
  size?: IconSizeKey | number;
  className?: string;
}) {
  const id = normalizeStickerId(sticker);
  if (!id) return null;
  const Icon = stickerIconMap[id];
  const px = iconPx(size);
  return (
    <Icon
      size={px}
      strokeWidth={2}
      className={`inline-block shrink-0 ${className}`}
      aria-hidden
    />
  );
}

export function IconLabel({
  icon: Icon,
  children,
  size = "md",
  className = "",
  iconClassName = "text-gray-600",
  gapClass = "gap-2",
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  size?: IconSizeKey | number;
  className?: string;
  iconClassName?: string;
  gapClass?: string;
}) {
  const px = iconPx(size);
  return (
    <span className={`inline-flex items-center ${gapClass} ${className}`}>
      <Icon size={px} strokeWidth={2} className={`shrink-0 ${iconClassName}`} />
      <span>{children}</span>
    </span>
  );
}

export {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  Bell,
  Bot,
  Brain,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Cookie,
  Copy,
  Cpu,
  Cuboid,
  Download,
  Dumbbell,
  Flame,
  GraduationCap,
  Hand,
  Heart,
  HeartPulse,
  Home,
  Leaf,
  Lightbulb,
  Link,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  Moon,
  Palette,
  Paperclip,
  PartyPopper,
  Plus,
  Rocket,
  Ruler,
  Salad,
  Scale,
  ScrollText,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Ticket,
  Users,
  UtensilsCrossed,
  Wrench,
  Zap,
  Droplets,
  LineChart,
};
