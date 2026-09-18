# 自訂域名設定

正式公開網址係 **`https://fitclub.hk`**。學員／教練／原生殼都用呢個域名；**唔需要** `*.vercel.app`。

Vercel 仍然可以係 hosting（env、Cron、SSL），只係唔好再把 `fitclub-pearl.vercel.app` 當公開 App 連結。部分網絡會解析唔到 `*.vercel.app`（Safari：「server can't be found」），自訂域名喺香港網絡穩定好多。

---

## 建議網址

| 用途 | 建議 |
|------|------|
| 主站（學員／教練開） | `https://fitclub.hk` |
| www | `https://www.fitclub.hk`（可選，redirect 去主站） |
| Vercel 預設 alias | 僅後台／preview，唔好分享俾學員 |

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

### 4. 更新環境變數

Production 環境改成（儲存後 **Redeploy**）：

| 變數 | 新值 |
|------|------|
| `NEXT_PUBLIC_SITE_URL` | `https://fitclub.hk` |
| `NEXT_PUBLIC_APP_URL` | `https://fitclub.hk` |
| `CAPACITOR_SERVER_URL` | `https://fitclub.hk`（如有用原生殼） |
| `OPENROUTER_HTTP_REFERER` | `https://fitclub.hk`（如有） |

程式碼預設已經係 `https://fitclub.hk`；環境變數只係覆寫。Stripe / OAuth / 允許網域清單如有白名單，一併加入新域名。

### 5. 通知學員／教練（重要）

舊主畫面圖示可能仲鎖住 `*.vercel.app`：

1. 刪走舊主畫面 App
2. 用 Safari 開 **`https://fitclub.hk`**
3. 分享 → 加入主畫面
4. 重新登入一次

邀請連結、QR code、WhatsApp 文案全部用 `https://fitclub.hk`。

---

## 驗收清單

- [ ] `dig fitclub.hk A` 有記錄
- [ ] `https://fitclub.hk` 用 Wi‑Fi 開到
- [ ] Vercel Domain 顯示 Valid
- [ ] 環境變數已改並 Redeploy（或確認已用 repo 預設）
- [ ] 邀請／分享連結已用 `https://fitclub.hk`
- [ ] Capacitor `allowNavigation` 含 `fitclub.hk` / `*.fitclub.hk`
- [ ] 至少 1 位學員用 Wi‑Fi + 新主畫面圖示驗證成功
