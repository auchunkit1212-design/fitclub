-- 食咩好（What to Eat）專用表 — 唔改主 app 既有 schema
-- 喺 Supabase SQL Editor 執行本檔

create table if not exists public.wte_diet_profiles (
  email text primary key,
  goal_type text not null default 'maintain',
  job text not null default 'sedentary',
  weekly_frequency text not null default '1-2',
  meal_schedule text not null default 'threeMeals',
  cooking_scenes text[] not null default '{}',
  diet_styles text[] not null default '{}',
  allergens text[] not null default '{}',
  disliked_ingredients text[] not null default '{}',
  cuisine_prefs text[] not null default '{}',
  protein_priority text not null default 'normal',
  protein_sources text[] not null default '{}',
  medical_flags text[] not null default '{}',
  medical_disclaimer_accepted boolean not null default false,
  calorie_mode text not null default 'auto',
  target_calories integer not null default 2000,
  target_protein integer not null default 120,
  target_carbs integer not null default 200,
  target_fats integer not null default 60,
  onboarding_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.wte_meal_plans (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  week_start date not null,
  payload jsonb not null,
  notes text,
  version integer not null default 1,
  regenerate_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wte_meal_plans_email_week_idx
  on public.wte_meal_plans (email, week_start desc);

create table if not exists public.wte_plan_favorites (
  email text not null,
  plan_id uuid not null references public.wte_meal_plans (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (email, plan_id)
);

create table if not exists public.wte_usage (
  email text not null,
  month_key text not null,
  generate_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (email, month_key)
);

-- 建議用 service role 由 Next API 讀寫；若要用 anon + RLS，可另加 policy
alter table public.wte_diet_profiles enable row level security;
alter table public.wte_meal_plans enable row level security;
alter table public.wte_plan_favorites enable row level security;
alter table public.wte_usage enable row level security;
