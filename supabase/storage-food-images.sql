-- FitClub 食物相片 Storage（Bucket: food-images）
-- 在 Supabase SQL Editor 執行一次
--
-- 前端使用 supabase-js + NEXT_PUBLIC_SUPABASE_ANON_KEY 直傳此 Bucket。
-- 必須允許 anon INSERT（本 App 用 Cookie Session，非 Supabase Auth JWT）。

-- 1) 建立公開 Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-images',
  'food-images',
  true,
  1048576,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) meal_logs 公開 URL 欄位
alter table meal_logs
  add column if not exists image_url text;

-- 3) Storage RLS
drop policy if exists "food_images_public_read" on storage.objects;
drop policy if exists "food_images_insert_auth" on storage.objects;
drop policy if exists "food_images_insert_anon" on storage.objects;
drop policy if exists "food_images_update_own" on storage.objects;
drop policy if exists "food_images_delete_own" on storage.objects;

-- 公開讀取
create policy "food_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'food-images');

-- Supabase Auth 已登入用戶可上傳
create policy "food_images_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'food-images');

-- anon key 可上傳（FitClub 前端 anon client 直傳必需）
create policy "food_images_insert_anon"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'food-images');

create policy "food_images_update_own"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'food-images')
  with check (bucket_id = 'food-images');

create policy "food_images_delete_own"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'food-images');
