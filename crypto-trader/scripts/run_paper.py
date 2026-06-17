#!/usr/bin/env python3
"""模擬盤（Paper Trading）入口。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.config import load_config
from src.exchange.ccxt_client import CcxtExchangeClient
from src.exchange.mock_client import MockExchangeClient
from src.portfolio.tracker import PortfolioTracker
from src.trading.bot import TradingBot
from src.utils.logger import setup_logger


def main() -> None:
    parser = argparse.ArgumentParser(description="Run paper trading bot")
    parser.add_argument("--config", default=None)
    parser.add_argument("--once", action="store_true", help="Run one iteration only")
    args = parser.parse_args()

    config = load_config(args.config)
    config.mode = "paper"
    setup_logger("paper", config.logging.level, config.logging.file)

    try:
        exchange = CcxtExchangeClient(config.exchange)
    except Exception:
        print("Exchange unavailable; using mock data for paper trading.")
        exchange = MockExchangeClient()
    portfolio = PortfolioTracker(
        initial_cash=config.backtest.initial_capital,
        persist_path="data/paper_portfolio.json",
    )
    bot = TradingBot(config, exchange, portfolio, live=False)

    if args.once:
        bot.run_once()
    else:
        bot.run_forever()


if __name__ == "__main__":
    main()
