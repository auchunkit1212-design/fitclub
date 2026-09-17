-- 總裁後台：記錄可查看的明文密碼（僅 Service Role 讀寫；新註冊／重設密碼後寫入）
alter table users_registry add column if not exists password_plain text;

comment on column users_registry.password_plain is 'Admin-visible plaintext password; set on register/reset only.';
