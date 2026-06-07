-- Community 貼文留言
-- 在 Supabase SQL Editor 貼上並執行一次

create table if not exists community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts (id) on delete cascade,
  author_email text not null,
  author_name text not null,
  body_text text not null check (char_length(trim(body_text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists community_post_comments_post_idx
  on community_post_comments (post_id, created_at asc);

create index if not exists community_post_comments_author_idx
  on community_post_comments (author_email);

alter table community_post_comments enable row level security;

drop policy if exists "community_post_comments_all" on community_post_comments;

create policy "community_post_comments_all"
  on community_post_comments
  for all
  to anon, authenticated
  using (true)
  with check (true);
