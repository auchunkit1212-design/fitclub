-- Phase 4: social links, coach targets, reactions, favorites
-- Run in Supabase SQL Editor after phase3-student-profiles.sql

create table if not exists student_nutrition_targets (
  student_email text primary key references users_registry (email) on delete cascade,
  target_calories integer not null default 2000,
  target_protein integer not null default 120,
  target_carbs integer not null default 200,
  target_fats integer not null default 65,
  locked boolean not null default false,
  set_by_coach_email text,
  updated_at timestamptz not null default now()
);

create table if not exists meal_log_reactions (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references meal_logs (id) on delete cascade,
  coach_email text not null,
  sticker text not null,
  created_at timestamptz not null default now(),
  unique (meal_log_id, coach_email)
);

create table if not exists favorite_foods (
  id uuid primary key default gen_random_uuid(),
  student_email text not null references users_registry (email) on delete cascade,
  name text not null,
  brand text default '',
  calories integer not null default 0,
  protein integer not null default 0,
  carbs integer not null default 0,
  fats integer not null default 0,
  serving_label text default '1 份',
  use_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists favorite_foods_student_idx on favorite_foods (student_email, last_used_at desc);
create index if not exists meal_log_reactions_log_idx on meal_log_reactions (meal_log_id);

alter table student_nutrition_targets enable row level security;
alter table meal_log_reactions enable row level security;
alter table favorite_foods enable row level security;

create policy "phase4_targets_all" on student_nutrition_targets for all using (true) with check (true);
create policy "phase4_reactions_all" on meal_log_reactions for all using (true) with check (true);
create policy "phase4_favorites_all" on favorite_foods for all using (true) with check (true);
