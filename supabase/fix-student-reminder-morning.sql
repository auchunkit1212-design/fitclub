-- 新增學員自訂朝早提醒時間（已有 student_reminder_settings 表時執行）
alter table student_reminder_settings
  add column if not exists last_morning_push_key text;

alter table student_reminder_settings
  add column if not exists morning_reminder_time text not null default '08:00';
