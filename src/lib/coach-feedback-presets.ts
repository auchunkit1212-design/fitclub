export type CoachFeedbackPreset = {
  id: string;
  label: string;
  message: string;
};

/** 教練批閱學員餐單時可選的預設評語 */
export const COACH_FEEDBACK_PRESETS: CoachFeedbackPreset[] = [
  {
    id: "good_choice",
    label: "選擇唔錯",
    message: "呢餐選擇唔錯，繼續保持！",
  },
  {
    id: "great_logging",
    label: "打卡準時",
    message: "打卡好準時，好習慣！繼續記錄。",
  },
  {
    id: "more_protein",
    label: "加蛋白",
    message: "蛋白質稍為偏低，下餐可以加多啲肉、蛋或豆製品。",
  },
  {
    id: "less_carbs",
    label: "碳水偏高",
    message: "碳水偏高，下次可以少啲飯或麵，多啲菜。",
  },
  {
    id: "watch_fat",
    label: "留意油脂",
    message: "脂肪同隱形油分偏高，試下走汁、少醬。",
  },
  {
    id: "add_veggies",
    label: "加蔬菜",
    message: "記得多加蔬菜，纖維同飽肚感都會更好。",
  },
  {
    id: "portion_control",
    label: "控制份量",
    message: "份量稍大，下次可以試細掌或細拳。",
  },
  {
    id: "hydrate",
    label: "記得飲水",
    message: "記得飲多啲水，配合飲食計劃效果更好。",
  },
];

export function getCoachFeedbackPreset(
  presetKey: string
): CoachFeedbackPreset | undefined {
  return COACH_FEEDBACK_PRESETS.find((p) => p.id === presetKey);
}

export function isValidCoachFeedbackPreset(presetKey: string): boolean {
  return Boolean(getCoachFeedbackPreset(presetKey));
}
