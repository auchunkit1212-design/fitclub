-- Fix: student_body_profiles RLS for FitClub custom session (not Supabase Auth)
-- This app uses email in users_registry + API cookie session, NOT auth.uid().
-- Run in Supabase SQL Editor if onboarding upsert fails with RLS errors.

alter table student_body_profiles enable row level security;

drop policy if exists "student_body_profiles_all" on student_body_profiles;
drop policy if exists "student_body_profiles_select" on student_body_profiles;
drop policy if exists "student_body_profiles_insert" on student_body_profiles;
drop policy if exists "student_body_profiles_update" on student_body_profiles;

-- Dev / MVP: allow anon & service role (API uses service role when configured)
create policy "student_body_profiles_select"
  on student_body_profiles for select
  using (true);

create policy "student_body_profiles_insert"
  on student_body_profiles for insert
  with check (true);

create policy "student_body_profiles_update"
  on student_body_profiles for update
  using (true)
  with check (true);

-- Optional: ensure student row exists in users_registry before body profile
-- (FK already enforces email references users_registry)
