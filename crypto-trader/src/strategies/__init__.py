from __future__ import annotations

from src.strategies.base import Strategy
from src.strategies.macd_strategy import MacdStrategy
from src.strategies.rsi_strategy import RsiStrategy
from src.strategies.sma_crossover import SmaCrossoverStrategy

STRATEGY_REGISTRY: dict[str, type[Strategy]] = {
    SmaCrossoverStrategy.name: SmaCrossoverStrategy,
    RsiStrategy.name: RsiStrategy,
    MacdStrategy.name: MacdStrategy,
}


def get_strategy(name: str, params: dict | None = None) -> Strategy:
    cls = STRATEGY_REGISTRY.get(name)
    if cls is None:
        available = ", ".join(STRATEGY_REGISTRY)
        raise ValueError(f"Unknown strategy '{name}'. Available: {available}")
    return cls(params)
