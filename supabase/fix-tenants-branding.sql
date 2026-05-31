-- Nutrition Coach：租戶品牌 + 教練聖旨（student_nutrition_targets）
-- 可獨立執行；若表不存在會自動建立。在 Supabase SQL Editor 一次 Run。

-- ── 0) 前置：tenants（Phase 2）────────────────────────────
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  gym_name text not null,
  logo_url text,
  owner_email text not null,
  plan text not null default 'trial',
  theme_color text default 'emerald',
  created_at timestamptz not null default now()
);

alter table tenants add column if not exists theme_color text default 'emerald';

alter table users_registry add column if not exists tenant_id uuid references tenants (id);

-- ── 1) 教練聖旨表（Phase 4）────────────────────────────────
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

alter table student_nutrition_targets
  add column if not exists tenant_id uuid references tenants (id);

create index if not exists student_nutrition_targets_tenant_idx
  on student_nutrition_targets (tenant_id);

-- ── 2) Emoji 貼紙（動態牆，可選）────────────────────────────
create table if not exists meal_log_reactions (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references meal_logs (id) on delete cascade,
  coach_email text not null,
  sticker text not null,
  created_at timestamptz not null default now(),
  unique (meal_log_id, coach_email)
);

create index if not exists meal_log_reactions_log_idx on meal_log_reactions (meal_log_id);

-- ── 3) RLS（MVP：anon 可讀寫）──────────────────────────────
alter table tenants enable row level security;
drop policy if exists "dev_all_tenants" on tenants;
create policy "dev_all_tenants" on tenants
  for all to anon, authenticated using (true) with check (true);

alter table student_nutrition_targets enable row level security;
drop policy if exists "phase4_targets_all" on student_nutrition_targets;
drop policy if exists "student_nutrition_targets_all" on student_nutrition_targets;
create policy "student_nutrition_targets_all" on student_nutrition_targets
  for all to anon, authenticated using (true) with check (true);

alter table meal_log_reactions enable row level security;
drop policy if exists "phase4_reactions_all" on meal_log_reactions;
drop policy if exists "meal_log_reactions_all" on meal_log_reactions;
create policy "meal_log_reactions_all" on meal_log_reactions
  for all to anon, authenticated using (true) with check (true);
