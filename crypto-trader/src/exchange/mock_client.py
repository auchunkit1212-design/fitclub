from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from src.exchange.base import Balance, ExchangeClient, OrderResult


class MockExchangeClient(ExchangeClient):
    """離線模擬交易所 — 用合成 K 線做回測，無需 API。"""

    def __init__(self, seed: int = 42, bars: int = 2000) -> None:
        self._candles = self._generate_candles(seed=seed, bars=bars)
        self._price = float(self._candles["close"].iloc[-1])

    @staticmethod
    def _generate_candles(seed: int, bars: int) -> pd.DataFrame:
        rng = np.random.default_rng(seed)
        ts = pd.date_range("2024-01-01", periods=bars, freq="h", tz="UTC")
        returns = rng.normal(0.0002, 0.01, bars)
        close = 40000 * np.cumprod(1 + returns)
        noise = rng.uniform(-0.003, 0.003, bars)
        open_ = close * (1 + noise)
        high = np.maximum(open_, close) * (1 + rng.uniform(0, 0.005, bars))
        low = np.minimum(open_, close) * (1 - rng.uniform(0, 0.005, bars))
        volume = rng.uniform(100, 5000, bars)
        return pd.DataFrame(
            {
                "timestamp": ts,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": volume,
            }
        )

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 200) -> pd.DataFrame:
        return self._candles.tail(limit).reset_index(drop=True)

    def fetch_ticker(self, symbol: str) -> dict[str, Any]:
        return {"last": self._price, "close": self._price, "symbol": symbol}

    def fetch_balance(self) -> dict[str, Balance]:
        return {"USDT": Balance("USDT", 10000, 0, 10000)}

    def create_market_order(self, symbol: str, side: str, amount: float) -> OrderResult:
        self._price *= 1.0005 if side == "buy" else 0.9995
        return OrderResult("mock-1", symbol, side, amount, self._price, "closed")

    def create_limit_order(
        self, symbol: str, side: str, amount: float, price: float
    ) -> OrderResult:
        return OrderResult("mock-2", symbol, side, amount, price, "closed")
