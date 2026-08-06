# 自訂域名設定（解決部分 Wi‑Fi 開唔到）

## 點解會開唔到？

正式站而家係 `https://fitclub-pearl.vercel.app`。

部分屋企／公司／商場／學校 Wi‑Fi 嘅 DNS 會：

- 解析唔到 `*.vercel.app`（Safari：「server can't be found」）
- 或者攔截「預覽／臨時」網域

流動數據通常正常，所以會出現「關 Wi‑Fi 就得」嘅情況。學員用主畫面 App 都會中招。

**改善方法：** 用自己嘅域名（例如 `fitclub.hk` / `app.fitclub.hk`）指去 Vercel。自訂域名喺香港網絡穩定好多。

---

## 建議網址

| 用途 | 建議 |
|------|------|
| 主站（學員／教練開） | `https://fitclub.hk` 或 `https://app.fitclub.hk` |
| 舊 Vercel 網址 | 保留作後備，但唔好再分享俾學員 |

---

## 設定步驟（約 10–20 分鐘）

### 1. Vercel 加域名

1. 開 [Vercel Dashboard](https://vercel.com) → 專案 **fitclub**（或對應 Production 專案）
2. **Settings → Domains → Add**
3. 加入：
   - `fitclub.hk`
   - `www.fitclub.hk`（可選，建議一齊加）
4. Vercel 會顯示要加嘅 DNS 記錄（通常係）：

**根域名 `fitclub.hk`（推薦 A 記錄）：**

| Type | Name | Value |
|------|------|--------|
| A | `@` | `76.76.21.21` |

**或按 Vercel 畫面顯示嘅最新 IP／CNAME（以 Dashboard 為準）。**

**`www`：**

| Type | Name | Value |
|------|------|--------|
| CNAME | `www` | `cname.vercel-dns.com` |

### 2. 域名註冊商加 DNS

去你買 `fitclub.hk` 嘅地方（例如 Cloudflare、GoDaddy、Namecheap、香港註冊商）：

1. 開 DNS 管理
2. 照 Vercel 顯示加入 A / CNAME
3. 儲存後等生效（多數幾分鐘，最長可要數小時）

**建議：** 如果可以，用 **Cloudflare** 做 DNS（Proxy 可先關閉／灰色雲，等 SSL 批核後再開）。

### 3. 等 SSL 變绿色

Vercel Domains 頁面顯示該域名 **Valid** + HTTPS 證書 Ready 先算完成。

測試：

```bash
curl -I https://fitclub.hk
# 應見 HTTP/2 200 同 server: Vercel
```

手機用 **Wi‑Fi** 開 `https://fitclub.hk`，確認唔再出現 “server can't be found”。

### 4. 更新 Vercel 環境變數

Production 環境改成（儲存後 **Redeploy**）：

| 變數 | 新值 |
|------|------|
| `NEXT_PUBLIC_SITE_URL` | `https://fitclub.hk` |
| `NEXT_PUBLIC_APP_URL` | `https://fitclub.hk` |
| `CAPACITOR_SERVER_URL` | `https://fitclub.hk`（如有用原生殼） |
| `OPENROUTER_HTTP_REFERER` | `https://fitclub.hk`（如有） |

Stripe / OAuth / 允許網域清單如有白名單，一併加入新域名。

### 5. 通知學員／教練（重要）

舊主畫面圖示可能仲鎖住 `*.vercel.app`：

1. 刪走舊主畫面 App
2. 用 Safari 開 **新域名**
3. 分享 → 加入主畫面
4. 重新登入一次

邀請連結、QR code、WhatsApp 文案全部改用新域名。

---

## 暫時緩解（域名未搞好之前）

- 教學員：**開唔到就關 Wi‑Fi 用流動數據**，或換第二個 Wi‑Fi
- iPhone DNS 可改手動：`1.1.1.1`、`8.8.8.8`
- 只分享 `https://fitclub-pearl.vercel.app`，唔好分享帶亂碼嘅 preview URL

呢啲只係權宜之計；長遠一定要自訂域名。

---

## 驗收清單

- [ ] `dig fitclub.hk A` 有記錄
- [ ] `https://fitclub.hk` 用 Wi‑Fi 開到
- [ ] Vercel Domain 顯示 Valid
- [ ] 環境變數已改並 Redeploy
- [ ] 邀請／分享連結已換新網址
- [ ] 至少 1 位學員用 Wi‑Fi + 新主畫面圖示驗證成功
