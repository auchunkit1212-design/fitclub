#!/usr/bin/env python3
"""回測入口腳本。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rich.console import Console
from rich.table import Table

from src.backtest.engine import BacktestEngine
from src.config import load_config
from src.exchange.ccxt_client import CcxtExchangeClient
from src.exchange.mock_client import MockExchangeClient
from src.utils.logger import setup_logger

console = Console()


def _create_exchange(config, offline: bool):
    if offline:
        return MockExchangeClient()
    try:
        return CcxtExchangeClient(config.exchange)
    except Exception as exc:
        console.print(f"[yellow]Exchange unavailable ({exc}); using mock data.[/yellow]")
        return MockExchangeClient()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run crypto strategy backtest")
    parser.add_argument("--config", default=None, help="Path to settings.yaml")
    parser.add_argument("--offline", action="store_true", help="Use synthetic data (no network)")
    args = parser.parse_args()

    config = load_config(args.config)
    logger = setup_logger("backtest", config.logging.level, config.logging.file)
    logger.info("Backtest %s %s", config.trading.symbol, config.strategy.name)

    exchange = _create_exchange(config, args.offline)
    engine = BacktestEngine(config, exchange)
    result = engine.run()

    table = Table(title="Backtest Metrics")
    table.add_column("Metric")
    table.add_column("Value", justify="right")
    for key, value in result.metrics.items():
        if key.endswith("_pct"):
            table.add_row(key, f"{value:.2f}%")
        else:
            table.add_row(key, f"{value:.4f}" if isinstance(value, float) else str(value))
    console.print(table)
    console.print(f"Trades: {len(result.trades)}")


if __name__ == "__main__":
    main()
