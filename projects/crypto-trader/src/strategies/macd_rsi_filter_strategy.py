from __future__ import annotations

import pandas as pd
import ta

from src.strategies.base import Signal, SignalAction, Strategy


class MacdRsiFilterStrategy(Strategy):
    name = "macd_rsi_filter"

    def __init__(self, params: dict | None = None) -> None:
        super().__init__(params)
        self.fast_period = int(self.params.get("fast_period", 12))
        self.slow_period = int(self.params.get("slow_period", 26))
        self.signal_period = int(self.params.get("signal_period", 9))
        self.rsi_period = int(self.params.get("rsi_period", 14))
        self.rsi_buy_max = float(self.params.get("rsi_buy_max", 55))
        self.rsi_sell_min = float(self.params.get("rsi_sell_min", 45))

    def warmup_bars(self) -> int:
        return max(self.slow_period + self.signal_period + 5, self.rsi_period + 5)

    def generate_signal(self, candles: pd.DataFrame) -> Signal:
        if len(candles) < self.warmup_bars():
            return Signal(SignalAction.HOLD, reason="insufficient data")

        df = candles.copy()
        macd_indicator = ta.trend.MACD(
            close=df["close"],
            window_fast=self.fast_period,
            window_slow=self.slow_period,
            window_sign=self.signal_period,
        )
        df["macd"] = macd_indicator.macd()
        df["macd_signal"] = macd_indicator.macd_signal()
        df["rsi"] = ta.momentum.RSIIndicator(df["close"], window=self.rsi_period).rsi()

        prev = df.iloc[-2]
        curr = df.iloc[-1]

        bullish_cross = prev["macd"] <= prev["macd_signal"] and curr["macd"] > curr["macd_signal"]
        bearish_cross = prev["macd"] >= prev["macd_signal"] and curr["macd"] < curr["macd_signal"]
        rsi_now = float(curr["rsi"])

        if bullish_cross and rsi_now <= self.rsi_buy_max:
            return Signal(
                SignalAction.BUY,
                strength=1.0,
                reason=(
                    f"MACD bull cross + RSI {rsi_now:.1f} <= {self.rsi_buy_max:.1f}"
                ),
            )
        if bearish_cross and rsi_now >= self.rsi_sell_min:
            return Signal(
                SignalAction.SELL,
                strength=1.0,
                reason=(
                    f"MACD bear cross + RSI {rsi_now:.1f} >= {self.rsi_sell_min:.1f}"
                ),
            )

        return Signal(SignalAction.HOLD, reason=f"filter not met (RSI {rsi_now:.1f})")
