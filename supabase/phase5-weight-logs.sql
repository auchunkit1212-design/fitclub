-- Phase 5: 學員每日體重記錄（weight_logs）
-- 在 Supabase SQL Editor 執行一次（於 schema.sql / phase3 之後）
--
-- FitClub 以 users_registry.email 識別用戶（非 Supabase Auth user_id）

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  email text not null references users_registry (email) on delete cascade,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 500),
  log_date date not null default (current_date),
  created_at timestamptz not null default now(),
  unique (email, log_date)
);

create index if not exists weight_logs_email_idx on weight_logs (email);
create index if not exists weight_logs_log_date_idx on weight_logs (log_date desc);
create index if not exists weight_logs_email_date_idx on weight_logs (email, log_date desc);

alter table weight_logs enable row level security;

drop policy if exists "weight_logs_select" on weight_logs;
drop policy if exists "weight_logs_insert" on weight_logs;
drop policy if exists "weight_logs_update" on weight_logs;
drop policy if exists "weight_logs_delete" on weight_logs;

-- MVP：FitClub 前端用 anon key + email session（同 meal_logs）
-- 正式環境可改為 auth.jwt() ->> 'email' = email
create policy "weight_logs_select"
  on weight_logs for select
  to anon, authenticated
  using (true);

create policy "weight_logs_insert"
  on weight_logs for insert
  to anon, authenticated
  with check (true);

create policy "weight_logs_update"
  on weight_logs for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "weight_logs_delete"
  on weight_logs for delete
  to anon, authenticated
  using (true);
