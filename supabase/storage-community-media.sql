-- Community 媒體 Storage（相片 + 短片）
-- 在 Supabase SQL Editor 執行一次

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  true,
  6291456,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community_media_public_read" on storage.objects;
drop policy if exists "community_media_insert_anon" on storage.objects;
drop policy if exists "community_media_update" on storage.objects;
drop policy if exists "community_media_delete" on storage.objects;

create policy "community_media_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'community-media');

create policy "community_media_insert_anon"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'community-media');

create policy "community_media_update"
  on storage.objects for update
  to anon
  using (bucket_id = 'community-media')
  with check (bucket_id = 'community-media');

create policy "community_media_delete"
  on storage.objects for delete
  to anon
  using (bucket_id = 'community-media');
