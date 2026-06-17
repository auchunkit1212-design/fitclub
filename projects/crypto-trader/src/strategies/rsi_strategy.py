from __future__ import annotations

import pandas as pd
import ta

from src.strategies.base import Signal, SignalAction, Strategy


class RsiStrategy(Strategy):
    name = "rsi"

    def __init__(self, params: dict | None = None) -> None:
        super().__init__(params)
        self.period = int(self.params.get("period", 14))
        self.oversold = float(self.params.get("oversold", 30))
        self.overbought = float(self.params.get("overbought", 70))

    def warmup_bars(self) -> int:
        return self.period + 5

    def generate_signal(self, candles: pd.DataFrame) -> Signal:
        if len(candles) < self.warmup_bars():
            return Signal(SignalAction.HOLD, reason="insufficient data")

        df = candles.copy()
        df["rsi"] = ta.momentum.RSIIndicator(df["close"], window=self.period).rsi()
        rsi = float(df["rsi"].iloc[-1])

        if rsi < self.oversold:
            return Signal(SignalAction.BUY, strength=min(1.0, (self.oversold - rsi) / 20), reason=f"RSI {rsi:.1f} oversold")
        if rsi > self.overbought:
            return Signal(SignalAction.SELL, strength=min(1.0, (rsi - self.overbought) / 20), reason=f"RSI {rsi:.1f} overbought")
        return Signal(SignalAction.HOLD, reason=f"RSI {rsi:.1f} neutral")
