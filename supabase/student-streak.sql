-- 學員連續打卡 Streak（users_registry）
-- Supabase SQL Editor → Run

alter table users_registry add column if not exists current_streak integer not null default 0;
alter table users_registry add column if not exists longest_streak integer not null default 0;
alter table users_registry add column if not exists last_streak_update timestamptz;

comment on column users_registry.current_streak is '連續打卡天數';
comment on column users_registry.longest_streak is '歷史最長連續打卡';
comment on column users_registry.last_streak_update is '上次計入 streak 的日期（以打卡日為準）';
