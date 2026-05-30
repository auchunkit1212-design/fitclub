-- 修復舊版 meal_logs 缺少欄位（PGRST204: carbs / protein / fats / image_url）
-- 在 Supabase → SQL Editor 執行一次

alter table meal_logs
  add column if not exists protein integer not null default 0;

alter table meal_logs
  add column if not exists carbs integer not null default 0;

alter table meal_logs
  add column if not exists fats integer not null default 0;

alter table meal_logs
  add column if not exists image_base64 text;

alter table meal_logs
  add column if not exists image_url text;

-- 若 meal_type 欄位名稱不同（極舊 schema），請手動對照 Table Editor 調整
