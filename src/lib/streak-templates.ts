export const STREAK_CARD_TEMPLATE_IDS = [
  "emerald",
  "sunset",
  "midnight",
  "ocean",
  "minimal",
] as const;

export type StreakCardTemplateId = (typeof STREAK_CARD_TEMPLATE_IDS)[number];

export const STREAK_CARD_TEMPLATE_STORAGE_KEY = "streak_card_template";

export type StreakTemplateMeta = {
  id: StreakCardTemplateId;
  label: string;
  description: string;
  preview: {
    from: string;
    via?: string;
    to: string;
    accent: string;
    text: string;
  };
  modal: {
    shell: string;
    hero: string;
    badge: string;
    cta: string;
    save: string;
  };
};

export const STREAK_CARD_TEMPLATES: Record<
  StreakCardTemplateId,
  StreakTemplateMeta
> = {
  emerald: {
    id: "emerald",
    label: "翠綠經典",
    description: "品牌綠色，清爽自律感",
    preview: {
      from: "#047857",
      via: "#059669",
      to: "#0f766e",
      accent: "#6ee7b7",
      text: "#ffffff",
    },
    modal: {
      shell: "bg-white",
      hero: "bg-gradient-to-br from-emerald-100 to-teal-50",
      badge: "bg-emerald-600 text-white",
      cta: "bg-emerald-600 hover:bg-emerald-700 text-white",
      save: "bg-zinc-900 hover:bg-zinc-800 text-white",
    },
  },
  sunset: {
    id: "sunset",
    label: "烈焰日落",
    description: "暖色能量，打卡火焰感",
    preview: {
      from: "#ea580c",
      via: "#f97316",
      to: "#dc2626",
      accent: "#fde68a",
      text: "#ffffff",
    },
    modal: {
      shell: "bg-gradient-to-b from-orange-50 to-white",
      hero: "bg-gradient-to-br from-orange-200 to-rose-100",
      badge: "bg-orange-600 text-white",
      cta: "bg-orange-600 hover:bg-orange-700 text-white",
      save: "bg-rose-900 hover:bg-rose-950 text-white",
    },
  },
  midnight: {
    id: "midnight",
    label: "黑金質感",
    description: "深色高級，里程碑專用感",
    preview: {
      from: "#0f172a",
      via: "#1e293b",
      to: "#020617",
      accent: "#fbbf24",
      text: "#fef3c7",
    },
    modal: {
      shell: "bg-gradient-to-b from-slate-900 to-slate-800 text-white",
      hero: "bg-gradient-to-br from-amber-500/20 to-slate-700/40 ring-1 ring-amber-400/30",
      badge: "bg-amber-500 text-slate-900",
      cta: "bg-amber-500 hover:bg-amber-400 text-slate-900",
      save: "bg-slate-700 hover:bg-slate-600 text-white",
    },
  },
  ocean: {
    id: "ocean",
    label: "海洋清新",
    description: "藍綠漸層，輕盈健康風",
    preview: {
      from: "#0369a1",
      via: "#0ea5e9",
      to: "#14b8a6",
      accent: "#a5f3fc",
      text: "#ffffff",
    },
    modal: {
      shell: "bg-gradient-to-b from-sky-50 to-white",
      hero: "bg-gradient-to-br from-sky-200 to-cyan-100",
      badge: "bg-sky-600 text-white",
      cta: "bg-sky-600 hover:bg-sky-700 text-white",
      save: "bg-cyan-900 hover:bg-cyan-950 text-white",
    },
  },
  minimal: {
    id: "minimal",
    label: "極簡白卡",
    description: "留白大標題，適合分享",
    preview: {
      from: "#f8fafc",
      to: "#ffffff",
      accent: "#059669",
      text: "#0f172a",
    },
    modal: {
      shell: "bg-white ring-1 ring-zinc-100",
      hero: "bg-zinc-50 ring-1 ring-zinc-200",
      badge: "bg-zinc-900 text-white",
      cta: "bg-zinc-900 hover:bg-zinc-800 text-white",
      save: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
  },
};

export function normalizeStreakCardTemplate(
  value: unknown
): StreakCardTemplateId {
  if (
    typeof value === "string" &&
    (STREAK_CARD_TEMPLATE_IDS as readonly string[]).includes(value)
  ) {
    return value as StreakCardTemplateId;
  }
  return "emerald";
}

export function getStreakCardTemplate(): StreakCardTemplateId {
  if (typeof window === "undefined") return "emerald";
  try {
    return normalizeStreakCardTemplate(
      localStorage.getItem(STREAK_CARD_TEMPLATE_STORAGE_KEY)
    );
  } catch {
    return "emerald";
  }
}

export function setStreakCardTemplate(id: StreakCardTemplateId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STREAK_CARD_TEMPLATE_STORAGE_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

export function getStreakTemplateMeta(
  id: StreakCardTemplateId
): StreakTemplateMeta {
  return STREAK_CARD_TEMPLATES[id];
}
