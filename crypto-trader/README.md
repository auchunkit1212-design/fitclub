# Crypto Auto Trader

模組化 Python 加密貨幣自動交易系統，支援**回測**、**模擬盤（Paper）**、**實盤（Live）**三種模式。

> **風險提示**：加密貨幣交易有高風險，可能損失全部本金。本系統僅供學習與研究，不構成投資建議。實盤前請先用回測與模擬盤驗證策略。

## 功能概覽

| 模組 | 說明 |
|------|------|
| **交易所** | 透過 [CCXT](https://github.com/ccxt/ccxt) 連接 Binance 等主流交易所 |
| **策略** | 可插拔策略框架；內建 SMA 均線交叉、RSI、MACD 策略 |
| **風控** | 倉位上限、日內虧損熔斷、止損／止盈 |
| **組合** | 持倉追蹤、成交記錄、JSON 持久化 |
| **回測** | 歷史 K 線模擬，輸出報酬率、最大回撤、Sharpe |
| **Bot** | 定時輪詢市場、產生信號、執行買賣 |

## 快速開始

```bash
cd crypto-trader
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # 回測／模擬盤可不填 API key
```

### 1. 回測（建議第一步）

```bash
# 離線模式（合成數據，無需網絡）
python scripts/run_backtest.py --offline

# 真實歷史 K 線（需能連接交易所公開 API）
python scripts/run_backtest.py
```

修改 `config/settings.yaml` 中的 `strategy`、`backtest.start_date` 等參數後重跑。

### 2. 模擬盤

用真實行情、虛擬資金，不會真正下單：

```bash
# 單次執行
python scripts/run_paper.py --once

# 持續運行（每 60 秒輪詢，可在 settings.yaml 調整）
python scripts/run_paper.py
```

查看組合狀態：

```bash
python scripts/status.py
```

### 3. 實盤（謹慎）

1. 在 `.env` 填入 API Key（建議先用交易所**測試網**）
2. 設定 `USE_TESTNET=true`
3. 執行：

```bash
python scripts/run_live.py --confirm-live --once
```

## 專案結構

```
crypto-trader/
├── config/settings.yaml    # 主設定（策略、風控、交易對）
├── .env.example            # API 金鑰（勿提交 .env）
├── scripts/
│   ├── run_backtest.py     # 回測
│   ├── run_paper.py        # 模擬盤
│   ├── run_live.py         # 實盤
│   └── status.py           # 組合狀態
├── src/
│   ├── config.py           # 設定載入
│   ├── exchange/           # CCXT 交易所適配
│   ├── strategies/         # 策略（可擴展）
│   ├── risk/               # 風控
│   ├── portfolio/          # 組合追蹤
│   ├── backtest/           # 回測引擎
│   ├── trading/            # Bot 主迴圈
│   └── data/               # 行情工具
└── tests/                  # 單元測試
```

## 設定說明

`config/settings.yaml` 主要欄位：

```yaml
mode: paper                  # paper | live | backtest
trading:
  symbol: BTC/USDT           # 交易對
  timeframe: 1h              # K 線週期
  base_order_size_usd: 100   # 每筆下單金額（USD）
strategy:
  name: sma_crossover        # sma_crossover | rsi | macd
  params:
    fast_period: 10
    slow_period: 30
    # macd 可加：signal_period: 9
risk:
  max_position_pct: 0.25     # 單倉上限
  stop_loss_pct: 0.03        # 止損 3%
  take_profit_pct: 0.06      # 止盈 6%
  max_daily_loss_pct: 0.05   # 日虧 5% 暫停
```

## 新增自訂策略

1. 在 `src/strategies/` 建立新檔，繼承 `Strategy` 基類
2. 實作 `generate_signal(candles) -> Signal`
3. 在 `src/strategies/__init__.py` 的 `STRATEGY_REGISTRY` 註冊
4. 將 `config/settings.yaml` 的 `strategy.name` 改為你的策略名

範例請參考 `src/strategies/sma_crossover.py`。
MACD 範例請參考 `src/strategies/macd_strategy.py`。

## 測試

```bash
pip install -r requirements.txt
pytest tests/ -v
```

---

## 點樣同 Cursor AI 合作開發

以下係實用工作流程，幫你用 AI 逐步完善呢個交易系統。

### 第一步：講清楚目標

向 AI 描述時，盡量包含：

- **做咩**：例如「加 MACD 策略」「接 OKX 交易所」「做 Web Dashboard」
- **限制**：例如「只改 `crypto-trader/`，唔好動 fitness app」「實盤前要測試網」
- **驗收標準**：例如「回測總報酬 > 0」「`pytest` 全過」「有 CLI 可以跑」

**好嘅 prompt 範例：**

> 幫我喺 `crypto-trader` 加一個 MACD 策略，參數 fast=12 slow=26 signal=9，註冊到 registry，並寫單元測試。唔好改其他檔案。

> 幫我做一個簡單 Web Dashboard（Next.js 或 Streamlit 都得），顯示 paper portfolio 嘅 equity curve 同最近 10 筆成交。

### 第二步：分階段迭代

建議順序：

1. **回測驗證** → 調策略參數
2. **模擬盤跑一兩星期** → 觀察滑點、信號頻率
3. **測試網實盤** → 驗證 API、下單邏輯
4. **小額實盤** → 逐步放大

每次只叫 AI 做**一個明確功能**，比一次叫佢「做完整量化平台」效果更好。

### 第三步：提供上下文

AI 睇唔到你螢幕，以下資料越具體越好：

- 貼上**錯誤訊息**完整 stack trace
- 話明你改咗邊個檔、預期同實際行為
- 提供 `config/settings.yaml` 相關段落
- 若係交易所問題，話明係 testnet 定 mainnet

### 第四步：Code Review 習慣

AI 改完 code 後，你應該：

1. 跑 `pytest tests/ -v`
2. 跑 `python scripts/run_backtest.py` 睇 metrics
3. 檢查 `config/settings.yaml` 風控參數
4. **永遠唔好將 `.env` 或 API key 提交 Git**

### 第五步：常用協作指令模板

複製以下模板，填入你嘅需求：

```
【任務】在 crypto-trader 加入 XXX 功能
【模式】只回測 / 要支援實盤
【交易所】Binance testnet
【策略】基於現有 sma_crossover 擴展
【驗收】pytest 通過 + 回測可跑 + 更新 README
【不要】改 fitness app 嘅 src/
```

```
【Bug】run_paper.py 報錯：{貼上錯誤}
【環境】Python 3.11, Ubuntu
【已試】pip install -r requirements.txt 已做
【預期】--once 可以跑完一輪
```

```
【優化】回測太慢，幫我加本地 CSV 快取 K 線
【範圍】只改 src/data/ 同 scripts/run_backtest.py
```

### 第六步：Cloud Agent / PR 流程

若你用 Cursor Cloud Agent（背景自動改 code）：

1. Agent 會開 branch（例如 `cursor/crypto-auto-trader-ac40`）
2. 改完會 push 同開 **Pull Request**
3. 你 Review PR → merge 前先本地跑測試
4. 有問題喺 PR 留言，或開新 task 叫 Agent 修正

### 建議下一步擴展（可以逐個叫 AI 做）

- [ ] 更多策略：MACD、Bollinger Bands、網格交易
- [ ] Telegram / Discord 成交通知
- [ ] Streamlit 或 Next.js Dashboard
- [ ] 多交易對組合、資金配置
- [ ] 本地 K 線 CSV 快取（減少 API 請求）
- [ ] Docker 部署 + systemd / cron 常駐
- [ ] 訂單類型：限價單、OCO
- [ ] 策略參數自動優化（grid search）

---

## 授權

本目錄 code 供學習使用。使用本系統進行實盤交易的一切後果由使用者自行承擔。
