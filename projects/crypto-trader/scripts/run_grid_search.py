#!/usr/bin/env python3
"""策略參數 grid search 優化。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rich.console import Console
from rich.table import Table

from src.backtest.optimizer import run_grid_search
from src.config import load_config
from src.exchange.mock_client import MockExchangeClient
from src.exchange.caching_client import CachingExchangeClient
from src.exchange.ccxt_client import CcxtExchangeClient
from src.utils.logger import setup_logger

console = Console()


def _parse_param(value: str) -> list:
    parts = [p.strip() for p in value.split(",") if p.strip()]
    parsed: list = []
    for part in parts:
        if part.isdigit():
            parsed.append(int(part))
        else:
            try:
                parsed.append(float(part))
            except ValueError:
                parsed.append(part)
    return parsed


def _create_exchange(config, offline: bool):
    if offline:
        return MockExchangeClient()
    try:
        inner = CcxtExchangeClient(config.exchange)
        if config.data.ohlcv_cache_enabled:
            return CachingExchangeClient(config, inner)
        return inner
    except Exception as exc:
        console.print(f"[yellow]Exchange unavailable ({exc}); using mock data.[/yellow]")
        return MockExchangeClient()


def main() -> None:
    parser = argparse.ArgumentParser(description="Grid search strategy parameters")
    parser.add_argument("--config", default=None)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument(
        "--param",
        action="append",
        default=[],
        metavar="KEY=VAL1,VAL2",
        help="Grid dimension, e.g. --param fast_period=5,10,15",
    )
    parser.add_argument("--metric", default="total_return_pct")
    parser.add_argument("--top", type=int, default=10)
    args = parser.parse_args()

    config = load_config(args.config)
    setup_logger("grid_search", config.logging.level, config.logging.file)

    param_grid: dict[str, list] = {}
    for item in args.param:
        if "=" not in item:
            console.print(f"[red]Invalid --param: {item}[/red]")
            sys.exit(1)
        key, raw = item.split("=", 1)
        param_grid[key.strip()] = _parse_param(raw)

    if not param_grid:
        param_grid = {
            "fast_period": [5, 10, 15],
            "slow_period": [20, 30, 40],
        }
        console.print("[yellow]No --param provided; using default SMA grid.[/yellow]")

    exchange = _create_exchange(config, args.offline)
    results = run_grid_search(config, exchange, param_grid, metric=args.metric)
    top = results.head(args.top)

    table = Table(title=f"Grid Search Top {len(top)} by {args.metric}")
    for col in top.columns:
        table.add_column(str(col))
    for _, row in top.iterrows():
        table.add_row(*[f"{row[col]:.4f}" if isinstance(row[col], float) else str(row[col]) for col in top.columns])
    console.print(table)


if __name__ == "__main__":
    main()
