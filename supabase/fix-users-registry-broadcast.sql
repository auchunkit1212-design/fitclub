-- 修復教練後台「發布緊急廣播 / 品牌設定」PGRST204: broadcast 欄位缺失
-- 喺 Supabase → SQL Editor 貼上並 Run

alter table users_registry add column if not exists app_title text;
alter table users_registry add column if not exists theme_color text default 'emerald';
alter table users_registry add column if not exists logo text;
alter table users_registry add column if not exists broadcast text default '';

update users_registry
set broadcast = coalesce(broadcast, '')
where role = 'coach' and broadcast is null;
