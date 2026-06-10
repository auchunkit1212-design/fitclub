# Nutrition Coach — 白標健身飲食追蹤 SaaS

**Coach! what to eat?** — B2B 多租戶健身飲食追蹤平台。教練可白標品牌、管理學員；學員記錄飲食、接收 AI 營養建議，並與教練互動。

Next.js 14 App Router · Tailwind CSS · Supabase · PWA · Web Push · AI（OpenRouter）

**正式站範例：** https://fitclub-pearl.vercel.app

## 功能概覽

### 學員端

- 主頁：今日宏量進度、AI 吐槽、體重趨勢、打卡 streak
- 記錄飲食：相片上傳、**AI 相片分拆食物**、份量選擇、營養標籤 OCR、條碼掃描
- 食物搜尋：**AI 聯想優先**（OpenRouter）+ 港台本地庫 fallback；支援單字搜尋
- 儲存前 AI 驗證營養數值（卡路里／蛋白質／碳水／脂肪）
- 歷史日曆：翻查過往飲食、教練貼紙／評語；**可刪除錯誤記錄**
- 「教練！食咩好？」：按剩餘每日宏量生成配餐建議
- **社群探索**：雲端 Feed、發文、留言、讚好（需 Supabase SQL）
- 個人頁、App 設定（提醒、語言、PWA）
- Pro 會員：進階微量營養素、雲端頭像同步

### 教練 / Admin 端

- 白標品牌：App 標題、主題色、Logo、緊急廣播
- 邀請碼 + 分享註冊連結（學員自動綁定租戶）
- 學員管理：活動牆、飲食記錄、目標設定（教練聖旨）
- 單一學員 nudge、**一鍵提醒全部學員**（Web Push）
- Meal reactions、文字評語、AI 週報
- **總裁 Admin**：帳戶即時儲存、密碼查閱、刪除帳戶、健身室列表／刪除、學員調配

### 後端基建

- Supabase 雲端資料庫（多租戶、meal logs、體重、streak、社群）
- Vercel Cron：朝早／晚間提醒、教練 CRM、AI coach
- Web Push：學員打卡通知教練、教練 nudge 學員
- 多語言：繁中（香港／台灣）、英文

## 快速開始

```bash
git clone <repo-url>
cd fitness-diet-saas
npm install
cp .env.example .env.local
# 填寫 .env.local（至少 Supabase；AI 建議 OpenRouter）
npm run dev
```

瀏覽 [http://localhost:3000](http://localhost:3000)

```bash
npm run dev:lan   # 區網測試（0.0.0.0）
npm run build     # 正式建置
npm run lint      # ESLint
```

## 環境變數

複製 `.env.example` 為 `.env.local`（**勿將真 key 提交 Git**）。

### 必要

| 變數 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 伺服器寫入、Storage、admin API |

### AI（強烈建議）

| 變數 | 用途 |
|------|------|
| `OPENROUTER_API_KEY` | 食物搜尋、營養估算、相片分拆 |
| `OPENROUTER_MODEL` | 文字 AI（建議 `deepseek/deepseek-chat`） |
| `OPENROUTER_AUTOCOMPLETE_MODEL` | 食物搜尋 autocomplete（建議 `meta-llama/llama-4-scout`） |
| `OPENROUTER_VISION_MODEL` | 相片辨識（建議 `meta-llama/llama-4-maverick`） |
| `OPENROUTER_HTTP_REFERER` 或 `NEXT_PUBLIC_APP_URL` | OpenRouter HTTP-Referer |

> `google/gemini-2.5-flash` 在部分 OpenRouter 帳戶會 403，請用上面模型。帳戶需有餘額。

### Web Push

| 變數 | 用途 |
|------|------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 前端訂閱 |
| `VAPID_PRIVATE_KEY` | 伺服器發送 |
| `VAPID_SUBJECT` | `mailto:your@email.com` |
| `CRON_SECRET` | Vercel Cron 驗證 |

```bash
npx web-push generate-vapid-keys
```

### 選填

| 變數 | 用途 |
|------|------|
| `OPENAI_API_KEY` | OCR / Vision 後備 |
| `EDAMAM_APP_ID` / `EDAMAM_APP_KEY` | Edamam 食物 API（備用） |

### 健康檢查

部署後可開：

```
GET /api/food-search/status
```

`ok: true` 表示 OpenRouter 就緒。

## Supabase 設定

**完整清單見 [`supabase/PRODUCTION_CHECKLIST.md`](supabase/PRODUCTION_CHECKLIST.md)**（必跑順序、驗證 SQL、常見錯誤）。

### 新專案最短路徑

1. 依序執行 `schema.sql` → `phase2` … → `storage-food-images.sql`（共 11 個，見清單第一階段）
2. 執行社群 + 評語模組：`community-posts.sql`、`community-post-comments.sql`、`storage-community-media.sql`、`meal-log-feedback.sql`
3. 設定 Vercel env 並 Redeploy

### 已有舊庫

只補跑清單 **第二階段** 未執行過的腳本；出錯時查 **第三階段** `fix-*.sql`。

## 頁面路由

### 學員

| 路由 | 說明 |
|------|------|
| `/` | 主頁 |
| `/add-meal` | 記錄飲食 |
| `/history` | 歷史日曆 |
| `/community` | 社群探索 |
| `/profile` | 個人頁（含飲食記錄、刪除） |
| `/settings` | App 設定 |
| `/register` | 登入／註冊 |

### 教練 / Admin

| 路由 | 說明 |
|------|------|
| `/coach` | 品牌、廣播、AI 週報 |
| `/coach/students` | 學員管理、活動牆、一鍵提醒 |
| `/coach/records` | 學員記錄檢視 |
| `/admin` | 總裁後台（帳戶、健身室） |

### 其他

| 路由 | 說明 |
|------|------|
| `/sas-register` | SAS 合作教練註冊 |

## 底部導覽

**學員**：探索 → 主頁 → ➕（記錄飲食）→ 我的 → 設定

**教練**：探索 → 主頁 → ➕（學員）→ 學員 → 教練

## 部署（Vercel）

1. 連接 Git repo
2. **Settings → Environment Variables**：同步 `.env.example`（至少 Supabase + OpenRouter + VAPID）
3. Deploy
4. 確認 Cron（`vercel.json`）：朝早提醒、晚間總結、CRM、AI coach
5. 跑齊 [Supabase 清單](supabase/PRODUCTION_CHECKLIST.md)
6. 驗證 `/api/food-search/status`

## 專案結構

```
src/
  app/           # Next.js 頁面、API routes
  components/    # React UI
  lib/           # 業務邏輯、Supabase、AI、session
  messages/      # i18n（zh-HK、zh-TW、en）
  data/          # 本地食物 JSON
supabase/        # SQL 腳本 + PRODUCTION_CHECKLIST.md
public/          # PWA、靜態資源
```

## 示範帳戶

開發環境見 `src/lib/demo-users.ts`（如 `owner@gmail.com` / `student@gmail.com`）。

## 已知限制

- **飲水提醒**（設定頁 1h/2h/4h）已儲存偏好，**尚未接入定時推播**
- **自訂朝早時間**：Cron 每日約 08:00 HKT 跑一次；非 08:00 的學員可能收唔到（需更密 cron 或 Pro plan）
- 食物搜尋 **AI 優先**，冷門字可能要等數秒；AI 失敗才 fallback 本地庫
- 刪除飲食記錄 **唔會** 自動刪 Storage 內舊相片
- 社群雲端失敗時會 fallback **本機假動態**（畫面會提示）
- `/api/food-search-ai` 為封存備用；正式用 `/api/food-search`
- 無 automated tests；回歸靠人手驗證
