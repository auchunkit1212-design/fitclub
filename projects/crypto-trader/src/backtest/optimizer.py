from __future__ import annotations

import copy
import itertools
from typing import Any

import pandas as pd

from src.backtest.engine import BacktestEngine
from src.config import AppConfig
from src.exchange.base import ExchangeClient


def expand_param_grid(param_grid: dict[str, list[Any]]) -> list[dict[str, Any]]:
    if not param_grid:
        return [{}]
    keys = list(param_grid.keys())
    combos = itertools.product(*(param_grid[key] for key in keys))
    return [dict(zip(keys, values, strict=True)) for values in combos]


def run_grid_search(
    config: AppConfig,
    exchange: ExchangeClient,
    param_grid: dict[str, list[Any]],
    metric: str = "total_return_pct",
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for params in expand_param_grid(param_grid):
        trial_config = copy.deepcopy(config)
        trial_config.strategy.params = {**trial_config.strategy.params, **params}
        result = BacktestEngine(trial_config, exchange).run()
        row = {**params, **result.metrics, "trades": len(result.trades)}
        rows.append(row)

    df = pd.DataFrame(rows)
    if metric in df.columns:
        return df.sort_values(metric, ascending=False).reset_index(drop=True)
    return df
