import {
  computeAiTargetsFromBody,
  isAiCoachEmail,
} from "@/lib/nutrition-compliance";
import { isBodyProfileComplete } from "@/lib/body-profile";
import { fetchStudentBodyProfile } from "@/lib/db";
import {
  fetchStudentNutritionTargets,
  upsertStudentNutritionTargets,
} from "@/lib/phase4-db";
import { AI_GORILLA_COACH_EMAIL } from "@/lib/registry-constants";
import type { StudentBodyProfile } from "@/lib/types";

/** 身體檔案更新後，同步 AI / 未鎖定教練目標（人類教練鎖定則保留） */
export async function syncNutritionTargetsFromBodyProfile(
  email: string,
  profile?: StudentBodyProfile | null
): Promise<void> {
  const body =
    profile ?? (await fetchStudentBodyProfile(email.trim().toLowerCase()));
  if (!body || !isBodyProfileComplete(body)) return;

  const existing = await fetchStudentNutritionTargets(email);
  const humanCoachLocked =
    existing?.locked &&
    existing.setByCoachEmail &&
    !isAiCoachEmail(existing.setByCoachEmail);

  if (humanCoachLocked) return;

  const shouldSync =
    !existing?.targetCalories ||
    isAiCoachEmail(existing.setByCoachEmail);

  if (!shouldSync) return;

  const macro = computeAiTargetsFromBody(body);
  await upsertStudentNutritionTargets(
    {
      studentEmail: email.trim().toLowerCase(),
      targetCalories: macro.calories,
      targetProtein: macro.protein,
      targetCarbs: macro.carbs,
      targetFats: macro.fats,
      locked: true,
      setByCoachEmail:
        existing?.setByCoachEmail &&
        isAiCoachEmail(existing.setByCoachEmail)
          ? existing.setByCoachEmail
          : AI_GORILLA_COACH_EMAIL,
      tenantId: existing?.tenantId,
    },
    { useServiceRole: true }
  );
}
