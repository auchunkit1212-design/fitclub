# Supabase 正式站設定清單

在 [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor** 貼上並執行。  
**新專案**請跟「第一階段」順序跑；**已有舊庫**只需補「第二階段」未跑過的腳本。

執行後到 Vercel 設定環境變數並 **Redeploy**（見根目錄 `README.md`）。

---

## 第一階段：必跑（新專案由零開始）

| # | 檔案 | 用途 | 依賴 |
|---|------|------|------|
| 1 | `schema.sql` | `users_registry`、`meal_logs` 基礎表 | — |
| 2 | `phase2-tenants.sql` | 多租戶 `tenants`、學員綁定 | 1 |
| 3 | `phase3-student-profiles.sql` | 學員身體資料 | 2 |
| 4 | `phase4-social-ai.sql` | 教練目標、`meal_log_reactions`、收藏 | 1 |
| 5 | `phase5-weight-logs.sql` | 體重記錄 | 1 |
| 6 | `user-plan.sql` | Pro 會員方案 | 1 |
| 7 | `student-streak.sql` | 打卡 streak | 1 |
| 8 | `student-reminder-settings.sql` | 朝早／飲水提醒設定 | 1 |
| 9 | `push_subscriptions.sql` | Web Push 訂閱 | 1 |
| 10 | `profile-avatar-cloud.sql` | 雲端頭像 | 1 |
| 11 | `storage-food-images.sql` | 食物相片 Storage + `meal_logs.image_url` | 1 |

> **Storage 提醒：** `storage-food-images.sql` 會建立 `food-images` bucket。若 Dashboard 未見 bucket，到 **Storage** 手動建立同名 public bucket 再重跑相關段落。

---

## 第二階段：功能模組（正式站建議全跑）

| # | 檔案 | 用途 | 未跑時症狀 |
|---|------|------|------------|
| 12 | `community-posts.sql` | 社群貼文 | 探索頁只顯示本地假動態 |
| 13 | `community-post-comments.sql` | 貼文留言 | 留言失敗 / 500 |
| 14 | `storage-community-media.sql` | 社群相片／影片 Storage | 上傳媒體失敗 |
| 15 | `meal-log-feedback.sql` | 教練文字評語 | 教練批閱評語無法儲存 |

執行順序：**12 → 13 → 14 → 15**（13 依賴 12；15 依賴 `meal_logs`）。

---

## 第三階段：升級／修正（舊庫或出錯時）

僅在對應問題出現時執行；可重複執行（多數用 `if not exists`）。

| 檔案 | 何時用 |
|------|--------|
| `fix-student-reminder-morning.sql` | 已有 `student_reminder_settings` 但缺少 `morning_reminder_time` |
| `fix-meal-logs-columns.sql` | 儲存飲食報錯 `PGRST204`（缺 protein/carbs/fats/image_url） |
| `fix-meal-log-reactions.sql` | 教練 Emoji 貼紙無法儲存 |
| `fix-tenants-branding.sql` | 租戶品牌欄位缺失、教練聖旨表不存在 |
| `fix-users-registry-broadcast.sql` | 教練廣播欄位缺失 |
| `fix-coach-read-rls.sql` | 教練讀唔到學員 meal/weight/registry |
| `fix-student-body-profiles-rls.sql` | 學員身體資料 RLS 問題 |
| `fix-rls.sql` | 一般 RLS 權限異常 |
| `admin-password-plain.sql` | 總裁後台需要查閱帳戶明文密碼（有安全風險，僅內部用） |

---

## 執行後驗證（SQL Editor）

```sql
-- 核心表
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users_registry', 'meal_logs', 'tenants',
    'community_posts', 'community_post_comments',
    'meal_log_feedback', 'meal_log_reactions',
    'push_subscriptions', 'student_reminder_settings'
  )
order by table_name;

-- Storage buckets（應有 food-images；跑過 14 後應有 community-media）
select id, name, public from storage.buckets;
```

預期至少見到 **9 個核心表**；跑齊社群／評語後應為 **11 個**。

---

## 與 Vercel 環境變數對照

| 功能 | 必要 SQL | 必要 Env |
|------|----------|----------|
| 登入／飲食記錄 | 1–11 | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` |
| 食物相片上傳 | 11 | 同上 |
| 社群 Feed | 12–14 | 同上 |
| 教練評語 | 15 | 同上 |
| Web Push | 9 | `VAPID_*`, `CRON_SECRET` |
| AI 食物搜尋／相片分拆 | — | `OPENROUTER_API_KEY` + model 變數（見 `.env.example`） |

---

## 快速自檢（正式站）

1. 學員記一餐 → `meal_logs` 有新 row  
2. 上傳食物相 → Storage `food-images` 有檔案  
3. 探索頁發文 → `community_posts` 有新 row（否則只係 local fallback）  
4. 教練送評語 → `meal_log_feedback` 有新 row  
5. `GET /api/food-search/status` → `ok: true`  

---

## 常見錯誤

| 錯誤訊息 | 處理 |
|----------|------|
| `relation "community_posts" does not exist` | 跑 `community-posts.sql` |
| `relation "meal_log_feedback" does not exist` | 跑 `meal-log-feedback.sql` |
| `PGRST204` / schema cache | 跑 `fix-meal-logs-columns.sql` |
| 教練睇唔到學員數據 | 跑 `fix-coach-read-rls.sql` |
| 推播發送失敗 | 確認 9 + Vercel `VAPID_*` |
