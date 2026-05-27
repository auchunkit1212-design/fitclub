# 白標健身飲食追蹤 SaaS（Mock 版）

Next.js 14 App Router + Tailwind CSS，資料存於 `localStorage`（無後端）。

## 開始使用

```bash
cd ~/Projects/fitness-diet-saas
npm install
npm run dev
```

瀏覽 [http://localhost:3000](http://localhost:3000)

## 頁面

- `/` — 學員主頁（進度、AI 吐槽、體重趨勢）
- `/add-meal` — 記錄飲食（相片 Base64、假 AI 估算、零食計算機）
- `/coach` — 教練白標後台（品牌、廣播、學員記錄複製）

## localStorage 鍵

- `user_profile` — 目標熱量/蛋白質
- `meal_logs` — 飲食記錄陣列
- `coach_branding` — App 標題與主題色
- `coach_broadcast` — 緊急廣播文字
