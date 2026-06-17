#!/usr/bin/env python3
"""預先下載並快取 K 線到本地 CSV。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rich.console import Console

from src.config import load_config
from src.data.ohlcv_service import fetch_ohlcv_for_backtest, get_cache
from src.exchange.ccxt_client import CcxtExchangeClient
from src.utils.logger import setup_logger

console = Console()


def main() -> None:
    parser = argparse.ArgumentParser(description="Prefetch OHLCV data into local CSV cache")
    parser.add_argument("--config", default=None)
    parser.add_argument("--symbol", default=None)
    parser.add_argument("--timeframe", default=None)
    parser.add_argument("--start", default=None, help="YYYY-MM-DD")
    parser.add_argument("--end", default=None, help="YYYY-MM-DD")
    args = parser.parse_args()

    config = load_config(args.config)
    config.data.ohlcv_cache_enabled = True
    setup_logger("cache_ohlcv", config.logging.level, config.logging.file)

    symbol = args.symbol or config.trading.symbol
    timeframe = args.timeframe or config.trading.timeframe
    if args.start:
        config.backtest.start_date = args.start
    if args.end:
        config.backtest.end_date = args.end

    try:
        exchange = CcxtExchangeClient(config.exchange)
    except Exception as exc:
        console.print(f"[red]Failed to connect exchange: {exc}[/red]")
        sys.exit(1)

    candles = fetch_ohlcv_for_backtest(config, exchange, symbol, timeframe)
    cache_path = get_cache(config).path(symbol, timeframe)
    console.print(f"[green]Cached {len(candles)} bars for {symbol} {timeframe}[/green]")
    console.print(f"File: {cache_path}")
    if not candles.empty:
        console.print(
            f"Range: {candles['timestamp'].iloc[0]} -> {candles['timestamp'].iloc[-1]}"
        )


if __name__ == "__main__":
    main()
