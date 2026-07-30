# 食咩好（What to Eat）

Nutrition Coach 姊妹 app：用同一帳號／Pro，生成**一星期餐單**（每餐外食 + 煮食），唔做飲食打卡。

## 同主 app 關係

| 項目 | 說明 |
|------|------|
| 帳號 | 同一 `users_registry` email／密碼 |
| Body profile | 共用 `student_body_profiles` |
| Pro | 共用主 app Pro（含教練帶學員 Pro）；開 Pro 請去主 app billing |
| 主 app 程式碼 | **唔改** `src/`；本目錄完全獨立 |

## 本地開發

```bash
cd what-to-eat
cp .env.example .env.local
# 填入同主 app 一樣嘅 Supabase / OpenRouter / PRO_EMAIL_ALLOWLIST
npm install
npm run dev
# → http://localhost:3001
```

主 app 可同時跑喺 `3000`。

## Supabase

喺 SQL Editor 執行：

[`supabase/001_wte_tables.sql`](supabase/001_wte_tables.sql)

會建立 `wte_diet_profiles`、`wte_meal_plans`、`wte_plan_favorites`、`wte_usage`。

## Freemium

- Free：每月 **1** 次生成一週餐單；每個 plan 最多 **3** 次 regenerate
- Pro：無限 generate／regenerate + 收藏
- 升級：連去 `MAIN_APP_BILLING_URL`（預設主 app `/billing`）

## 環境變數

見 [`.env.example`](.env.example)。重點：

- `NEXT_PUBLIC_SUPABASE_*`、`SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`（無 key 會用本地 fallback 週餐單）
- `MAIN_APP_URL` / `MAIN_APP_BILLING_URL` / `MAIN_APP_REGISTER_URL`

## Capacitor iOS（下一步）

Web／PWA 已就緒。上 iOS：

1. 部署 what-to-eat 到正式 HTTPS 網域
2. 設 `CAPACITOR_SERVER_URL` 為該網域
3. `npm i` 後：

```bash
npx cap add ios   # 首次
npx cap sync ios
npx cap open ios
```

`capacitor.config.ts` 已預留 `appId: hk.nutritioncoach.whattoeat`。

## Scripts

| 指令 | 用途 |
|------|------|
| `npm run dev` | 開發（port 3001） |
| `npm run build` | Production build |
| `npm start` | 起 production（3001） |
