-- 教練 Emoji 貼紙 / meal_log_reactions（動態牆批閱）
-- 在 Supabase SQL Editor 執行一次（可獨立於 phase4-social-ai.sql）

create table if not exists meal_log_reactions (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references meal_logs (id) on delete cascade,
  coach_email text not null,
  sticker text not null,
  created_at timestamptz not null default now(),
  unique (meal_log_id, coach_email)
);

create index if not exists meal_log_reactions_log_idx
  on meal_log_reactions (meal_log_id);

create index if not exists meal_log_reactions_coach_idx
  on meal_log_reactions (coach_email);

alter table meal_log_reactions enable row level security;

drop policy if exists "phase4_reactions_all" on meal_log_reactions;
drop policy if exists "meal_log_reactions_select" on meal_log_reactions;
drop policy if exists "meal_log_reactions_insert" on meal_log_reactions;
drop policy if exists "meal_log_reactions_update" on meal_log_reactions;
drop policy if exists "meal_log_reactions_all" on meal_log_reactions;

-- FitClub MVP：anon key 讀寫（API 亦會用 service role upsert）
create policy "meal_log_reactions_all"
  on meal_log_reactions
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- 注意：貼紙儲存於 meal_log_reactions，非 meal_logs 欄位。
-- meal_logs 本身不需 coach_reaction 欄位。
