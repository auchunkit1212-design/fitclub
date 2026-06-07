# Nutrition Coach — 白標健身飲食追蹤 SaaS

**Coach! what to eat?** — B2B 多租戶健身飲食追蹤平台。教練可白標品牌、管理學員；學員記錄飲食、接收 AI 營養建議，並與教練互動。

Next.js 14 App Router · Tailwind CSS · Supabase · PWA · Web Push · AI（OpenRouter / OpenAI Vision）

## 功能概覽

### 學員端

- 主頁：今日宏量進度、AI 吐槽、體重趨勢、打卡 streak
- 記錄飲食：相片上傳、份量選擇、零食計算機、營養標籤 OCR
- 食物搜尋：港台本地食物庫 + OpenRouter AI autocomplete
- 儲存前 AI 驗證營養數值（卡路里／蛋白質／碳水／脂肪）
- 歷史日曆：翻查過往飲食記錄同 AI 回饋
- 「教練！食咩好？」：按剩餘每日宏量生成配餐建議
- 社群探索、個人頁、App 設定（提醒、語言、PWA）
- Pro 會員：進階微量營養素、雲端頭像同步

### 教練 / Admin 端

- 白標品牌：App 標題、主題色、Logo、緊急廣播
- 邀請碼 + 分享註冊連結（學員自動綁定租戶）
- 學員管理：活動牆、飲食記錄、目標設定、nudge 提醒
- Meal reactions、合規儀表板、AI 週報
- Admin：帳戶目錄、密碼查閱、刪除帳戶、租戶分配

### 後端基建

- Supabase 雲端資料庫（多租戶、meal logs、體重、streak）
- Vercel Cron：晨間／晚間提醒、教練 CRM、AI coach
- Web Push：學員打卡時通知教練
- 多語言：繁中（香港／台灣）、英文

## 快速開始

```bash
git clone <repo-url>
cd fitness-diet-saas
npm install
cp .env.example .env.local
# 填寫 .env.local（至少設定 Supabase 變數）
npm run dev
```

瀏覽 [http://localhost:3000](http://localhost:3000)

其他指令：

```bash
npm run dev:lan   # 區網測試（0.0.0.0）
npm run build     # 正式建置
npm run lint      # ESLint
```

## 環境變數

複製 `.env.example` 為 `.env.local`，按需填寫：

| 變數 | 用途 | 必要 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 伺服器寫入、Storage 上傳 | 強烈建議 |
| `OPENROUTER_API_KEY` | 食物搜尋 autocomplete | 建議 |
| `OPENAI_API_KEY` | 營養標籤 OCR、AI 配餐 | 建議 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push 公鑰 | 選填 |
| `VAPID_PRIVATE_KEY` | Web Push 私鑰 | 選填 |
| `VAPID_SUBJECT` | Push 聯絡信箱（`mailto:` 格式） | 選填 |
| `CRON_SECRET` | Vercel Cron 驗證 | 部署時需要 |
| `EDAMAM_APP_ID` / `EDAMAM_APP_KEY` | Edamam 食物 API | 選填 |

未設定 AI / Edamam key 時，部分功能會 fallback 至示範模式（mock）。

### Web Push 金鑰生成

```bash
npx web-push generate-vapid-keys
```

將 Public Key 設為 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`，Private Key 設為 `VAPID_PRIVATE_KEY`。

## Supabase 設定

在 Supabase SQL Editor 按順序執行（`supabase/` 目錄）：

1. `schema.sql` — 基礎表（users_registry、meal_logs）
2. `phase2-tenants.sql` — 多租戶
3. `phase3-student-profiles.sql` — 學員身體資料
4. `phase4-social-ai.sql` — 社交、教練目標、reactions、favorites
5. `phase5-weight-logs.sql` — 體重記錄
6. `user-plan.sql` — Pro 會員方案
7. `student-streak.sql` — 打卡 streak
8. `student-reminder-settings.sql` — 提醒設定
9. `push_subscriptions.sql` — Web Push 訂閱
10. `profile-avatar-cloud.sql` — 雲端頭像
11. `storage-food-images.sql` — 食物相片 Storage

若遇到 RLS 或欄位問題，可額外執行 `fix-*.sql` 修正腳本。

## 頁面路由

### 學員

| 路由 | 說明 |
|------|------|
| `/` | 主頁（進度、AI 吐槽、體重） |
| `/add-meal` | 記錄飲食 |
| `/history` | 歷史日曆 |
| `/community` | 社群探索 |
| `/profile` | 個人頁 |
| `/settings` | App 設定 |
| `/register` | 登入／註冊 |

### 教練 / Admin

| 路由 | 說明 |
|------|------|
| `/coach` | 品牌設定、廣播、AI 週報 |
| `/coach/students` | 學員管理（活動牆、記錄、目標） |
| `/coach/records` | 學員記錄檢視 |

### 其他

| 路由 | 說明 |
|------|------|
| `/sas-register` | SAS 合作教練註冊 |

## 底部導覽

**學員**：探索 → 主頁 → ➕（記錄飲食）→ 我的 → 設定

**教練**：探索 → 主頁 → ➕（學員）→ 學員 → 教練

## 部署（Vercel）

1. 連接 Git repo 至 Vercel
2. 在 Vercel Environment Variables 設定 `.env.example` 內所有變數
3. Deploy 後確認 Cron job 正常（`vercel.json` 已定義每日提醒、CRM、AI coach）

## 專案結構

```
src/
  app/           # Next.js 頁面同 API routes
  components/    # React UI 元件
  lib/           # 業務邏輯、Supabase、AI、session
  messages/      # i18n 翻譯（zh-HK、zh-TW、en）
  data/          # 本地食物資料庫 JSON
supabase/        # SQL migration 腳本
scripts/         # 食物資料庫生成工具
public/          # PWA manifest、Service Worker、靜態資源
```

## 示範帳戶

開發環境內建 demo 帳戶（見 `src/lib/demo-users.ts`）：

- 教練：`owner@gmail.com`
- 學員：`student@gmail.com`

## 已知限制

- 社群 Feed 目前為示範動態，未接真實後端
- `/api/food-search-ai` 為備用路由，預設使用 `/api/food-search`
- 無 API key 時，OCR、Edamam 搜尋等會走 mock fallback
