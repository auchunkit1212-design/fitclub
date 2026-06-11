-- 教練餐單評價標籤（良好 / 注意 / 危險）
-- 在 Supabase SQL Editor 貼上並執行一次

create table if not exists meal_log_ratings (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references meal_logs (id) on delete cascade,
  coach_email text not null,
  rating text not null check (rating in ('good', 'caution', 'danger')),
  created_at timestamptz not null default now(),
  unique (meal_log_id, coach_email)
);

create index if not exists meal_log_ratings_log_idx
  on meal_log_ratings (meal_log_id);

create index if not exists meal_log_ratings_coach_idx
  on meal_log_ratings (coach_email);

alter table meal_log_ratings enable row level security;

drop policy if exists "meal_log_ratings_all" on meal_log_ratings;

create policy "meal_log_ratings_all"
  on meal_log_ratings
  for all
  to anon, authenticated
  using (true)
  with check (true);
