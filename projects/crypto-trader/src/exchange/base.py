from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import pandas as pd


@dataclass
class OrderResult:
    id: str
    symbol: str
    side: str
    amount: float
    price: float
    status: str
    raw: dict[str, Any] | None = None


@dataclass
class Balance:
    currency: str
    free: float
    used: float
    total: float


class ExchangeClient(ABC):
    @abstractmethod
    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 200) -> pd.DataFrame:
        raise NotImplementedError

    @abstractmethod
    def fetch_ticker(self, symbol: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def fetch_balance(self) -> dict[str, Balance]:
        raise NotImplementedError

    @abstractmethod
    def create_market_order(self, symbol: str, side: str, amount: float) -> OrderResult:
        raise NotImplementedError

    @abstractmethod
    def create_limit_order(
        self, symbol: str, side: str, amount: float, price: float
    ) -> OrderResult:
        raise NotImplementedError
