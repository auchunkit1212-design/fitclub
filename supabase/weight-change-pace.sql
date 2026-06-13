-- 學員每週體重變化目標（5 層：+1 / +0.5 / 0 / -0.5 / -1 kg/週）
-- 在 Supabase SQL Editor 執行一次

alter table public.student_body_profiles
  add column if not exists weight_change_kg_per_week numeric;

comment on column public.student_body_profiles.weight_change_kg_per_week is
  '每週目標體重變化 (kg)：1, 0.5, 0, -0.5, -1';

-- 舊學員未有設定 → 標記未完成，登入後會彈窗重新填寫
update public.student_body_profiles
set onboarding_complete = false
where weight_change_kg_per_week is null;
