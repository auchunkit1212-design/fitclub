from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.data.ohlcv_cache import OhlcvCache, symbol_cache_name
from src.data.ohlcv_service import _covers_range, fetch_ohlcv_cached
from src.config import AppConfig, DataConfig, ExchangeConfig
from src.exchange.mock_client import MockExchangeClient


def test_symbol_cache_name() -> None:
    assert symbol_cache_name("BTC/USDT") == "BTC_USDT"


def test_ohlcv_cache_merge_deduplicates(tmp_path: Path) -> None:
    cache = OhlcvCache("binance", tmp_path)
    ts = pd.date_range("2024-01-01", periods=3, freq="h", tz="UTC")
    df1 = pd.DataFrame(
        {
            "timestamp": ts,
            "open": [1, 2, 3],
            "high": [1, 2, 3],
            "low": [1, 2, 3],
            "close": [1, 2, 3],
            "volume": [10, 10, 10],
        }
    )
    df2 = df1.copy()
    df2.loc[2, "close"] = 99
    merged = cache.merge(df1, df2)
    assert len(merged) == 3
    assert float(merged.iloc[-1]["close"]) == 99


def test_ohlcv_cache_save_and_load(tmp_path: Path) -> None:
    cache = OhlcvCache("binance", tmp_path)
    ts = pd.date_range("2024-01-01", periods=2, freq="h", tz="UTC")
    df = pd.DataFrame(
        {
            "timestamp": ts,
            "open": [1, 2],
            "high": [1, 2],
            "low": [1, 2],
            "close": [1, 2],
            "volume": [10, 10],
        }
    )
    cache.save("BTC/USDT", "1h", df)
    loaded = cache.load("BTC/USDT", "1h")
    assert len(loaded) == 2
    assert cache.path("BTC/USDT", "1h").exists()


def test_covers_range() -> None:
    ts = pd.date_range("2024-01-01", periods=24, freq="h", tz="UTC")
    df = pd.DataFrame({"timestamp": ts, "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1})
    start = pd.Timestamp("2024-01-01", tz="UTC")
    end = pd.Timestamp("2024-01-01", tz="UTC") + pd.Timedelta(days=1)
    assert _covers_range(df, start, end) is True


def test_fetch_ohlcv_cached_uses_memory(tmp_path: Path) -> None:
    config = AppConfig(
        exchange=ExchangeConfig(id="binance"),
        data=DataConfig(
            ohlcv_cache_enabled=True,
            ohlcv_cache_dir=str(tmp_path),
            ohlcv_cache_ttl_hours=24,
        ),
    )
    exchange = MockExchangeClient()
    first = fetch_ohlcv_cached(config, exchange, "BTC/USDT", "1h", limit=50)
    second = fetch_ohlcv_cached(config, exchange, "BTC/USDT", "1h", limit=50)
    assert len(first) == 50
    assert len(second) == 50
    assert (tmp_path / "binance" / "BTC_USDT_1h.csv").exists()
