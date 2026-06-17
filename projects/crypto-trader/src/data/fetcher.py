from __future__ import annotations

import pandas as pd

from src.config import AppConfig
from src.data.ohlcv_service import fetch_ohlcv_cached
from src.exchange.ccxt_client import CcxtExchangeClient
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


def fetch_market_data(config: AppConfig, limit: int = 500) -> pd.DataFrame:
    client = CcxtExchangeClient(config.exchange)
    return fetch_ohlcv_cached(
        config,
        client,
        config.trading.symbol,
        config.trading.timeframe,
        limit=limit,
    )
