-- 教練餐單文字評語（預設句子 + 可選貼紙）
-- 在 Supabase SQL Editor 貼上並執行一次

create table if not exists meal_log_feedback (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references meal_logs (id) on delete cascade,
  coach_email text not null,
  preset_key text not null,
  message_text text not null,
  sticker text,
  created_at timestamptz not null default now(),
  unique (meal_log_id, coach_email)
);

create index if not exists meal_log_feedback_log_idx
  on meal_log_feedback (meal_log_id);

create index if not exists meal_log_feedback_coach_idx
  on meal_log_feedback (coach_email);

alter table meal_log_feedback enable row level security;

drop policy if exists "meal_log_feedback_all" on meal_log_feedback;

create policy "meal_log_feedback_all"
  on meal_log_feedback
  for all
  to anon, authenticated
  using (true)
  with check (true);
