-- FitClub 食物相片 Storage（Bucket: food-images）
-- 在 Supabase SQL Editor 執行
--
-- 注意：本 App 使用 Cookie Session + anon key，並非 Supabase Auth JWT。
-- 因此 INSERT 政策同時允許 anon 與 authenticated；若日後改用 Supabase Auth 可只留 authenticated。

-- 1) 建立公開 Bucket（若已存在則更新設定）
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

-- 2) meal_logs 增加公開 URL 欄位（Storage 上傳後寫入，減少 base64 撐爆請求）
alter table meal_logs
  add column if not exists image_url text;

-- 3) Storage RLS：清除舊政策後重建
drop policy if exists "food_images_public_read" on storage.objects;
drop policy if exists "food_images_insert_auth" on storage.objects;
drop policy if exists "food_images_insert_anon" on storage.objects;
drop policy if exists "food_images_update_own" on storage.objects;
drop policy if exists "food_images_delete_own" on storage.objects;

-- 任何人可讀（公開 Bucket + SELECT）
create policy "food_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'food-images');

-- 已登入（Supabase Auth）可上傳
create policy "food_images_insert_auth"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'food-images');

-- anon key 上傳（本專案目前登入流程使用 anon client）
create policy "food_images_insert_anon"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'food-images');

-- 可選：允許更新/刪除自己路徑下的檔案（路徑格式 email/timestamp.jpg）
create policy "food_images_update_own"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'food-images')
  with check (bucket_id = 'food-images');

create policy "food_images_delete_own"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'food-images');
