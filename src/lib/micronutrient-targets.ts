/** 建議每日微量營養攝取（參考 WHO / 香港衛生署常見指引，依目標熱量調整） */
export interface MicronutrientTargets {
  fiberGMin: number;
  sugarGMax: number;
  saturatedFatGMax: number;
  sodiumMgMax: number;
  cholesterolMgMax: number;
}

export function getRecommendedMicronutrientTargets(input: {
  targetCalories: number;
  targetCarbs?: number;
  targetFats?: number;
  weightKg?: number;
}): MicronutrientTargets {
  const cal = Math.max(1200, Math.round(input.targetCalories) || 2000);
  const carbs = Math.max(0, Math.round(input.targetCarbs ?? cal * 0.4 / 4));
  const fats = Math.max(0, Math.round(input.targetFats ?? cal * 0.28 / 9));
  const weight = input.weightKg && input.weightKg > 0 ? input.weightKg : 65;

  const fiberGMin = Math.round(
    Math.min(38, Math.max(22, cal * 0.012 + weight * 0.08))
  );
  const sugarGMax = Math.round(Math.min(60, Math.max(25, carbs * 0.35)));
  const saturatedFatGMax = Math.round(
    Math.min(25, Math.max(12, (cal * 0.1) / 9))
  );
  const sodiumMgMax = Math.round(Math.min(2300, Math.max(1500, cal * 1.2)));
  const cholesterolMgMax = Math.round(Math.min(300, Math.max(200, 200 + fats * 2)));

  return {
    fiberGMin,
    sugarGMax,
    saturatedFatGMax,
    sodiumMgMax,
    cholesterolMgMax,
  };
}
