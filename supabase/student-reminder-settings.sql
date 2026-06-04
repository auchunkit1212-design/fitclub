-- 學員飲水 / 飲食提醒設定（供 Cron 在 App 外發 Web Push）
-- 喺 Supabase SQL Editor 執行

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
