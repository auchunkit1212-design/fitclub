export const MEAL_STICKER_IDS = [
  "thumbs-up",
  "flame",
  "dumbbell",
  "star",
  "target",
  "heart",
  "clap",
  "salad",
] as const;

export type MealStickerId = (typeof MEAL_STICKER_IDS)[number];

const LEGACY_STICKER_TO_ID: Record<string, MealStickerId> = {
  "👍": "thumbs-up",
  "🔥": "flame",
  "💪": "dumbbell",
  "⭐": "star",
  "🎯": "target",
  "❤️": "heart",
  "👏": "clap",
  "🥗": "salad",
};

const ID_SET = new Set<string>(MEAL_STICKER_IDS);

export function normalizeStickerId(raw: string): MealStickerId | null {
  const trimmed = raw.trim();
  if (ID_SET.has(trimmed)) return trimmed as MealStickerId;
  return LEGACY_STICKER_TO_ID[trimmed] ?? null;
}

export function isValidSticker(raw: string): boolean {
  return normalizeStickerId(raw) !== null;
}

export const MEAL_STICKER_IDS_FOR_API = [...MEAL_STICKER_IDS];
