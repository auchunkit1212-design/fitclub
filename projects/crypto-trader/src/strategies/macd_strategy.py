from __future__ import annotations

import pandas as pd
import ta

from src.strategies.base import Signal, SignalAction, Strategy


class MacdStrategy(Strategy):
    name = "macd"

    def __init__(self, params: dict | None = None) -> None:
        super().__init__(params)
        self.fast_period = int(self.params.get("fast_period", 12))
        self.slow_period = int(self.params.get("slow_period", 26))
        self.signal_period = int(self.params.get("signal_period", 9))

    def warmup_bars(self) -> int:
        return self.slow_period + self.signal_period + 5

    def generate_signal(self, candles: pd.DataFrame) -> Signal:
        if len(candles) < self.warmup_bars():
            return Signal(SignalAction.HOLD, reason="insufficient data")

        df = candles.copy()
        indicator = ta.trend.MACD(
            close=df["close"],
            window_fast=self.fast_period,
            window_slow=self.slow_period,
            window_sign=self.signal_period,
        )
        df["macd"] = indicator.macd()
        df["macd_signal"] = indicator.macd_signal()

        prev = df.iloc[-2]
        curr = df.iloc[-1]

        if prev["macd"] <= prev["macd_signal"] and curr["macd"] > curr["macd_signal"]:
            return Signal(
                SignalAction.BUY,
                strength=1.0,
                reason=f"MACD bullish cross {self.fast_period}/{self.slow_period}/{self.signal_period}",
            )
        if prev["macd"] >= prev["macd_signal"] and curr["macd"] < curr["macd_signal"]:
            return Signal(
                SignalAction.SELL,
                strength=1.0,
                reason=f"MACD bearish cross {self.fast_period}/{self.slow_period}/{self.signal_period}",
            )
        return Signal(SignalAction.HOLD, reason="no MACD cross")
