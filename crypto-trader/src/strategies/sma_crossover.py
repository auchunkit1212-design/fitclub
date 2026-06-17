from __future__ import annotations

import pandas as pd

from src.strategies.base import Signal, SignalAction, Strategy


class SmaCrossoverStrategy(Strategy):
    name = "sma_crossover"

    def __init__(self, params: dict | None = None) -> None:
        super().__init__(params)
        self.fast_period = int(self.params.get("fast_period", 10))
        self.slow_period = int(self.params.get("slow_period", 30))

    def warmup_bars(self) -> int:
        return self.slow_period + 5

    def generate_signal(self, candles: pd.DataFrame) -> Signal:
        if len(candles) < self.warmup_bars():
            return Signal(SignalAction.HOLD, reason="insufficient data")

        df = candles.copy()
        df["sma_fast"] = df["close"].rolling(self.fast_period).mean()
        df["sma_slow"] = df["close"].rolling(self.slow_period).mean()

        prev = df.iloc[-2]
        curr = df.iloc[-1]

        if prev["sma_fast"] <= prev["sma_slow"] and curr["sma_fast"] > curr["sma_slow"]:
            return Signal(
                SignalAction.BUY,
                strength=1.0,
                reason=f"golden cross SMA{self.fast_period}/{self.slow_period}",
            )
        if prev["sma_fast"] >= prev["sma_slow"] and curr["sma_fast"] < curr["sma_slow"]:
            return Signal(
                SignalAction.SELL,
                strength=1.0,
                reason=f"death cross SMA{self.fast_period}/{self.slow_period}",
            )
        return Signal(SignalAction.HOLD, reason="no crossover")
