-- 若登入顯示「未授權」或雲端失敗，喺 Supabase SQL Editor 執行呢段：

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

insert into users_registry (email, name, role, gym, coach, added_by, app_title, theme_color)
values
  ('owner@gmail.com', '旺角店-張老闆', 'coach', 'FitClub 旺角店', null, 'auchunkit1212@gmail.com', 'fitclub.hk 連鎖管理', 'emerald'),
  ('student@gmail.com', '陳大文', 'student', 'FitClub 旺角店', '旺角店-張老闆', 'owner@gmail.com', null, 'emerald')
on conflict (email) do nothing;
