#!/usr/bin/env python3
"""實盤交易入口 — 需明確確認才會執行。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.config import load_config
from src.exchange.ccxt_client import CcxtExchangeClient
from src.portfolio.tracker import PortfolioTracker
from src.trading.bot import TradingBot
from src.utils.logger import setup_logger


def main() -> None:
    parser = argparse.ArgumentParser(description="Run LIVE trading bot")
    parser.add_argument("--config", default=None)
    parser.add_argument("--confirm-live", action="store_true", help="Required flag to enable live trading")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()

    if not args.confirm_live:
        print("ERROR: Live trading requires --confirm-live flag.")
        print("Make sure API keys are set and you understand the risks.")
        sys.exit(1)

    config = load_config(args.config)
    if not config.exchange.api_key or not config.exchange.api_secret:
        print("ERROR: API_KEY and API_SECRET must be set in .env for live trading.")
        sys.exit(1)

    config.mode = "live"
    setup_logger("live", config.logging.level, config.logging.file)

    exchange = CcxtExchangeClient(config.exchange)
    balances = exchange.fetch_balance()
    quote = config.trading.quote_currency
    cash = balances.get(quote, None)
    initial_cash = cash.total if cash else config.backtest.initial_capital

    portfolio = PortfolioTracker(
        initial_cash=initial_cash,
        persist_path="data/live_portfolio.json",
    )
    bot = TradingBot(config, exchange, portfolio, live=True)

    if args.once:
        bot.run_once()
    else:
        bot.run_forever()


if __name__ == "__main__":
    main()
