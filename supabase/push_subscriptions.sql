-- 儲存 Web Push 訂閱（每部手機一條 endpoint）
-- 喺 Supabase SQL Editor 執行

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
