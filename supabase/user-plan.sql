-- 用戶訂閱方案（free | pro），供 Pro 功能門控
alter table users_registry
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro'));

comment on column users_registry.plan is 'free | pro — Pro 功能權限';

-- Kit 總裁帳號（若在 registry 有學員／教練列）設為 pro
update users_registry
set plan = 'pro'
where lower(email) = lower('auchunkit1212@gmail.com');
