-- 個人頭像雲端同步（users_registry.avatar_url + Storage bucket: profile-avatars）
-- 在 Supabase SQL Editor 執行一次

alter table users_registry
  add column if not exists avatar_url text;

comment on column users_registry.avatar_url is 'Supabase Storage 公開 URL（profile-avatars bucket）';

-- 公開 Bucket（前端 anon client 直傳，與 food-images 相同模式）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  1048576,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_avatars_public_read" on storage.objects;
drop policy if exists "profile_avatars_insert_auth" on storage.objects;
drop policy if exists "profile_avatars_insert_anon" on storage.objects;
drop policy if exists "profile_avatars_update" on storage.objects;
drop policy if exists "profile_avatars_delete" on storage.objects;

create policy "profile_avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-avatars');

create policy "profile_avatars_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-avatars');

create policy "profile_avatars_insert_anon"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'profile-avatars');

create policy "profile_avatars_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'profile-avatars')
  with check (bucket_id = 'profile-avatars');

create policy "profile_avatars_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'profile-avatars');
