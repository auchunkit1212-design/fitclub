-- Community 社群貼文（雲端 Feed）
-- 在 Supabase SQL Editor 執行一次（於 schema.sql / phase4 之後）

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  author_email text not null references users_registry (email) on delete cascade,
  author_name text not null,
  kind text not null check (kind in ('thought', 'meal')),
  body_text text,
  media_type text check (media_type is null or media_type in ('image', 'video')),
  media_url text,
  meal_name text,
  calories integer,
  protein integer,
  carbs integer,
  fats integer,
  tenant_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_created_idx
  on community_posts (created_at desc);

create index if not exists community_posts_tenant_idx
  on community_posts (tenant_id, created_at desc);

create table if not exists community_post_likes (
  post_id uuid not null references community_posts (id) on delete cascade,
  user_email text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_email)
);

create index if not exists community_post_likes_user_idx
  on community_post_likes (user_email);

alter table community_posts enable row level security;
alter table community_post_likes enable row level security;

drop policy if exists "community_posts_all" on community_posts;
drop policy if exists "community_post_likes_all" on community_post_likes;

create policy "community_posts_all" on community_posts for all using (true) with check (true);
create policy "community_post_likes_all" on community_post_likes for all using (true) with check (true);
