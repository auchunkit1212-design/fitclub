-- FitClub 雲端數據庫（貼到 Supabase → SQL Editor → Run）

create extension if not exists "pgcrypto";

create table if not exists users_registry (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  role text not null check (role in ('student', 'coach')),
  gym text,
  coach text,
  logo text,
  added_by text,
  app_title text default '健身飲食追蹤',
  theme_color text default 'emerald',
  broadcast text default '',
  created_at timestamptz not null default now()
);

create table if not exists meal_logs (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  meal_type text not null,
  description text not null,
  calories integer not null default 0,
  protein integer not null default 0,
  carbs integer not null default 0,
  fats integer not null default 0,
  image_base64 text,
  created_at timestamptz not null default now()
);

create index if not exists meal_logs_email_idx on meal_logs (email);
create index if not exists meal_logs_created_at_idx on meal_logs (created_at desc);
create index if not exists users_registry_role_idx on users_registry (role);

alter table users_registry enable row level security;
alter table meal_logs enable row level security;

-- 開發用：允許 anon key 讀寫（正式環境請改用 Supabase Auth + 嚴格 RLS）
drop policy if exists "dev_all_users_registry" on users_registry;
create policy "dev_all_users_registry" on users_registry
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "dev_all_meal_logs" on meal_logs;
create policy "dev_all_meal_logs" on meal_logs
  for all to anon, authenticated
  using (true)
  with check (true);

-- Web Push 訂閱（學員 / 教練提醒）
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_email_idx on push_subscriptions (email);

alter table push_subscriptions enable row level security;

drop policy if exists "dev_all_push_subscriptions" on push_subscriptions;
create policy "dev_all_push_subscriptions" on push_subscriptions
  for all to anon, authenticated
  using (true)
  with check (true);

-- 學員飲水 / 飲食提醒設定（Cron 發 App 外 Web Push）
create table if not exists student_reminder_settings (
  email text primary key references users_registry (email) on delete cascade,
  water_reminder text not null default '2h'
    check (water_reminder in ('1h', '2h', '4h', 'off')),
  meal_schedule text not null default 'threeMeals'
    check (meal_schedule in ('threeMeals', 'fourMeals', 'fasting168')),
  morning_reminder_time text not null default '08:00',
  last_hydration_push_at timestamptz,
  last_meal_push_key text,
  last_morning_push_key text,
  updated_at timestamptz not null default now()
);

create index if not exists student_reminder_settings_updated_idx
  on student_reminder_settings (updated_at desc);

alter table student_reminder_settings enable row level security;

drop policy if exists "dev_all_student_reminder_settings" on student_reminder_settings;
create policy "dev_all_student_reminder_settings" on student_reminder_settings
  for all to anon, authenticated
  using (true)
  with check (true);

-- Demo 種子資料
insert into users_registry (email, name, role, gym, coach, added_by, app_title, theme_color)
values
  ('owner@gmail.com', '旺角店-張老闆', 'coach', 'FitClub 旺角店', null, 'auchunkit1212@gmail.com', 'fitclub.hk 連鎖管理', 'emerald'),
  ('student@gmail.com', '陳大文', 'student', 'FitClub 旺角店', '旺角店-張老闆', 'owner@gmail.com', null, 'emerald')
on conflict (email) do nothing;
