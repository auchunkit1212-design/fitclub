from __future__ import annotations

import pandas as pd

from src.config import AppConfig
from src.exchange.ccxt_client import CcxtExchangeClient
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


def fetch_market_data(config: AppConfig, limit: int = 500) -> pd.DataFrame:
    client = CcxtExchangeClient(config.exchange)
    return client.fetch_ohlcv(config.trading.symbol, config.trading.timeframe, limit=limit)
