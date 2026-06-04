"use client";

import { useI18n } from "@/components/I18nProvider";
import { IconLabel, Ruler } from "@/components/icons";
import type { StudentBodyProfile, StudentGender } from "@/lib/types";

interface BodyProfileFieldsProps {
  values: {
    heightCm: string;
    weightKg: string;
    age: string;
    gender: StudentGender;
    targetWeightKg: string;
    exerciseCaloriesDaily: string;
  };
  onChange: (patch: Partial<BodyProfileFieldsProps["values"]>) => void;
}

export function BodyProfileFields({ values, onChange }: BodyProfileFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 pt-2 border-t border-zinc-100">
      <h3 className="text-sm font-semibold text-zinc-800">
        <IconLabel icon={Ruler} iconClassName="text-zinc-600">
          {t("bodyProfile.sectionTitle", "身體數據")}
        </IconLabel>
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">{t("bodyProfile.height", "身高 (cm)")}</label>
          <input
            type="number"
            value={values.heightCm}
            onChange={(e) => onChange({ heightCm: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">{t("bodyProfile.weight", "體重 (kg)")}</label>
          <input
            type="number"
            value={values.weightKg}
            onChange={(e) => onChange({ weightKg: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">{t("bodyProfile.age", "歲數")}</label>
          <input
            type="number"
            value={values.age}
            onChange={(e) => onChange({ age: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">{t("bodyProfile.gender", "性別")}</label>
          <select
            value={values.gender}
            onChange={(e) =>
              onChange({ gender: e.target.value as StudentGender })
            }
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 bg-white"
          >
            <option value="male">{t("bodyProfile.genderMale", "男")}</option>
            <option value="female">{t("bodyProfile.genderFemale", "女")}</option>
            <option value="other">{t("bodyProfile.genderOther", "其他")}</option>
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs text-zinc-500">{t("bodyProfile.targetWeight", "目標體重 (kg)")}</label>
          <input
            type="number"
            value={values.targetWeightKg}
            onChange={(e) => onChange({ targetWeightKg: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs text-zinc-500">
            {t("bodyProfile.exerciseCalories", "今日運動消耗 (kcal)")}
          </label>
          <input
            type="number"
            min={0}
            value={values.exerciseCaloriesDaily}
            onChange={(e) => onChange({ exerciseCaloriesDaily: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
        </div>
      </div>
    </div>
  );
}

export function bodyProfileToFormValues(
  profile: StudentBodyProfile | null
): BodyProfileFieldsProps["values"] {
  return {
    heightCm: profile?.heightCm ? String(profile.heightCm) : "",
    weightKg: profile?.weightKg ? String(profile.weightKg) : "",
    age: profile?.age ? String(profile.age) : "",
    gender: profile?.gender ?? "male",
    targetWeightKg: profile?.targetWeightKg ? String(profile.targetWeightKg) : "",
    exerciseCaloriesDaily: profile?.exerciseCaloriesDaily
      ? String(profile.exerciseCaloriesDaily)
      : "0",
  };
}
