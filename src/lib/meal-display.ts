import type { MealLog } from "@/lib/types";

export function getMealImageSrc(log: Pick<MealLog, "imageUrl" | "imageBase64">): string | undefined {
  return log.imageUrl ?? log.imageBase64;
}
