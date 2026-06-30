from __future__ import annotations

from typing import Any

import pandas as pd

from src.config import AppConfig
from src.data.ohlcv_service import fetch_ohlcv_cached
from src.exchange.base import Balance, ExchangeClient, OrderResult


class CachingExchangeClient(ExchangeClient):
    """包裝交易所客戶端，為 OHLCV 查詢加入 CSV 快取。"""

    def __init__(self, config: AppConfig, inner: ExchangeClient) -> None:
        self.config = config
        self.inner = inner

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 200) -> pd.DataFrame:
        return fetch_ohlcv_cached(self.config, self.inner, symbol, timeframe, limit=limit)

    def fetch_ticker(self, symbol: str) -> dict[str, Any]:
        return self.inner.fetch_ticker(symbol)

    def fetch_balance(self) -> dict[str, Balance]:
        return self.inner.fetch_balance()

    def create_market_order(self, symbol: str, side: str, amount: float) -> OrderResult:
        return self.inner.create_market_order(symbol, side, amount)

    def create_limit_order(
        self, symbol: str, side: str, amount: float, price: float
    ) -> OrderResult:
        return self.inner.create_limit_order(symbol, side, amount, price)
