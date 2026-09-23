-- InBody / 身體組成記錄（body_composition_logs）
-- 在 Supabase SQL Editor 執行一次（於 phase5-weight-logs.sql 之後）
--
-- FitClub 以 users_registry.email 識別用戶（非 Supabase Auth user_id）

create table if not exists body_composition_logs (
  id uuid primary key default gen_random_uuid(),
  email text not null references users_registry (email) on delete cascade,
  log_date date not null default (current_date),
  weight_kg numeric check (weight_kg is null or (weight_kg > 0 and weight_kg < 500)),
  body_fat_pct numeric check (body_fat_pct is null or (body_fat_pct >= 0 and body_fat_pct <= 80)),
  muscle_mass_kg numeric check (muscle_mass_kg is null or (muscle_mass_kg >= 0 and muscle_mass_kg < 200)),
  skeletal_muscle_kg numeric check (
    skeletal_muscle_kg is null or (skeletal_muscle_kg >= 0 and skeletal_muscle_kg < 200)
  ),
  visceral_fat_level numeric check (
    visceral_fat_level is null or (visceral_fat_level >= 0 and visceral_fat_level <= 30)
  ),
  bmr_kcal numeric check (bmr_kcal is null or (bmr_kcal >= 0 and bmr_kcal < 10000)),
  body_water_pct numeric check (
    body_water_pct is null or (body_water_pct >= 0 and body_water_pct <= 100)
  ),
  image_url text,
  source text not null default 'inbody_ocr',
  raw_ai_json jsonb,
  created_at timestamptz not null default now(),
  unique (email, log_date)
);

create index if not exists body_composition_logs_email_idx
  on body_composition_logs (email);
create index if not exists body_composition_logs_log_date_idx
  on body_composition_logs (log_date desc);
create index if not exists body_composition_logs_email_date_idx
  on body_composition_logs (email, log_date desc);

alter table body_composition_logs enable row level security;

drop policy if exists "body_composition_logs_select" on body_composition_logs;
drop policy if exists "body_composition_logs_insert" on body_composition_logs;
drop policy if exists "body_composition_logs_update" on body_composition_logs;
drop policy if exists "body_composition_logs_delete" on body_composition_logs;

-- MVP：FitClub 前端用 anon key + email session（同 weight_logs / meal_logs）
create policy "body_composition_logs_select"
  on body_composition_logs for select
  to anon, authenticated
  using (true);

create policy "body_composition_logs_insert"
  on body_composition_logs for insert
  to anon, authenticated
  with check (true);

create policy "body_composition_logs_update"
  on body_composition_logs for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "body_composition_logs_delete"
  on body_composition_logs for delete
  to anon, authenticated
  using (true);
