-- 教練端讀取學員數據 RLS 修正（users_registry / meal_logs / weight_logs / student_body_profiles）
-- FitClub 使用 anon key + email session，MVP 階段允許 anon SELECT（同 fix-rls.sql）
-- 在 Supabase SQL Editor 執行一次

-- users_registry
alter table users_registry enable row level security;
drop policy if exists "dev_all_users_registry" on users_registry;
create policy "dev_all_users_registry" on users_registry
  for all to anon, authenticated
  using (true)
  with check (true);

-- meal_logs
alter table meal_logs enable row level security;
drop policy if exists "dev_all_meal_logs" on meal_logs;
create policy "dev_all_meal_logs" on meal_logs
  for all to anon, authenticated
  using (true)
  with check (true);

-- weight_logs（需先執行 phase5-weight-logs.sql）
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'weight_logs'
  ) then
    execute 'alter table weight_logs enable row level security';
    execute 'drop policy if exists "weight_logs_select" on weight_logs';
    execute 'drop policy if exists "weight_logs_insert" on weight_logs';
    execute 'drop policy if exists "weight_logs_update" on weight_logs';
    execute 'drop policy if exists "weight_logs_delete" on weight_logs';
    execute 'drop policy if exists "weight_logs_all" on weight_logs';
    execute 'create policy "weight_logs_all" on weight_logs for all to anon, authenticated using (true) with check (true)';
  end if;
end $$;

-- student_body_profiles
alter table student_body_profiles enable row level security;
drop policy if exists "student_body_profiles_all" on student_body_profiles;
drop policy if exists "student_body_profiles_select" on student_body_profiles;
drop policy if exists "student_body_profiles_insert" on student_body_profiles;
drop policy if exists "student_body_profiles_update" on student_body_profiles;
create policy "student_body_profiles_all" on student_body_profiles
  for all to anon, authenticated
  using (true)
  with check (true);

-- 正式環境可改為 tenant / coach email 條件，例如：
-- using (email in (select email from users_registry where added_by = current_setting('app.coach_email')))

-- meal_log_reactions（動態牆 Emoji 貼紙）— 詳見 fix-meal-log-reactions.sql
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'meal_log_reactions'
  ) then
    execute 'alter table meal_log_reactions enable row level security';
    execute 'drop policy if exists "phase4_reactions_all" on meal_log_reactions';
    execute 'drop policy if exists "meal_log_reactions_all" on meal_log_reactions';
    execute 'create policy "meal_log_reactions_all" on meal_log_reactions for all to anon, authenticated using (true) with check (true)';
  end if;
end $$;
