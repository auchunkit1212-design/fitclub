from __future__ import annotations

from typing import Any

import ccxt
import pandas as pd

from src.config import ExchangeConfig
from src.exchange.base import Balance, ExchangeClient, OrderResult
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


class CcxtExchangeClient(ExchangeClient):
    def __init__(self, config: ExchangeConfig) -> None:
        exchange_class = getattr(ccxt, config.id, None)
        if exchange_class is None:
            raise ValueError(f"Unsupported exchange: {config.id}")

        options: dict[str, Any] = {"enableRateLimit": config.rate_limit}
        if config.sandbox:
            options.setdefault("sandbox", True)

        self._exchange: ccxt.Exchange = exchange_class(
            {
                "apiKey": config.api_key or None,
                "secret": config.api_secret or None,
                "password": config.api_passphrase or None,
                **options,
            }
        )
        if config.sandbox and hasattr(self._exchange, "set_sandbox_mode"):
            self._exchange.set_sandbox_mode(True)

        self._exchange.load_markets()
        logger.info("Connected to exchange: %s (sandbox=%s)", config.id, config.sandbox)

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 200) -> pd.DataFrame:
        rows = self._exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
        df = pd.DataFrame(rows, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
        return df

    def fetch_ticker(self, symbol: str) -> dict[str, Any]:
        return self._exchange.fetch_ticker(symbol)

    def fetch_balance(self) -> dict[str, Balance]:
        raw = self._exchange.fetch_balance()
        balances: dict[str, Balance] = {}
        for currency, data in raw.get("total", {}).items():
            if not data:
                continue
            free = float(raw.get("free", {}).get(currency, 0) or 0)
            used = float(raw.get("used", {}).get(currency, 0) or 0)
            total = float(data or 0)
            balances[currency] = Balance(currency=currency, free=free, used=used, total=total)
        return balances

    def create_market_order(self, symbol: str, side: str, amount: float) -> OrderResult:
        order = self._exchange.create_order(symbol, "market", side, amount)
        return self._to_order_result(order)

    def create_limit_order(
        self, symbol: str, side: str, amount: float, price: float
    ) -> OrderResult:
        order = self._exchange.create_order(symbol, "limit", side, amount, price)
        return self._to_order_result(order)

    @staticmethod
    def _to_order_result(order: dict[str, Any]) -> OrderResult:
        return OrderResult(
            id=str(order.get("id", "")),
            symbol=str(order.get("symbol", "")),
            side=str(order.get("side", "")),
            amount=float(order.get("amount") or 0),
            price=float(order.get("average") or order.get("price") or 0),
            status=str(order.get("status", "")),
            raw=order,
        )
