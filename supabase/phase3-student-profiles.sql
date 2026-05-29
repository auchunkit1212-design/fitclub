-- Phase 3: student body metrics for onboarding & calorie targets
-- Run in Supabase SQL Editor after phase2-tenants.sql

create table if not exists student_body_profiles (
  email text primary key references users_registry (email) on delete cascade,
  height_cm numeric not null check (height_cm > 0),
  weight_kg numeric not null check (weight_kg > 0),
  age integer not null check (age > 0 and age < 120),
  gender text not null check (gender in ('male', 'female', 'other')),
  target_weight_kg numeric not null check (target_weight_kg > 0),
  exercise_calories_daily integer not null default 0 check (exercise_calories_daily >= 0),
  onboarding_complete boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table student_body_profiles enable row level security;

create policy "student_body_profiles_all" on student_body_profiles
  for all using (true) with check (true);
