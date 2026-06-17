from __future__ import annotations

from typing import TYPE_CHECKING

import pandas as pd

from src.data.ohlcv_cache import OhlcvCache

if TYPE_CHECKING:
    from src.config import AppConfig
    from src.exchange.base import ExchangeClient


def get_cache(config: AppConfig) -> OhlcvCache:
    return OhlcvCache(config.exchange.id, config.data.ohlcv_cache_dir)


def _normalize_ts(value: pd.Timestamp) -> pd.Timestamp:
    ts = pd.Timestamp(value)
    if ts.tz is None:
        return ts.tz_localize("UTC")
    return ts.tz_convert("UTC")


def _covers_range(df: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> bool:
    if df.empty:
        return False
    min_ts = _normalize_ts(df["timestamp"].min())
    max_ts = _normalize_ts(df["timestamp"].max())
    start_ts = _normalize_ts(start)
    end_ts = _normalize_ts(end)
    span = max(end_ts - start_ts, pd.Timedelta(hours=1))
    return min_ts <= start_ts and max_ts >= end_ts - span


def _filter_range(df: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    if df.empty:
        return df
    start_ts = _normalize_ts(start)
    end_ts = _normalize_ts(end)
    ts = pd.to_datetime(df["timestamp"], utc=True)
    return df[(ts >= start_ts) & (ts < end_ts)].reset_index(drop=True)


def fetch_ohlcv_cached(
    config: AppConfig,
    exchange: ExchangeClient,
    symbol: str,
    timeframe: str,
    limit: int = 200,
) -> pd.DataFrame:
    if not config.data.ohlcv_cache_enabled:
        return exchange.fetch_ohlcv(symbol, timeframe, limit=limit)

    cache = get_cache(config)
    cached = cache.load(symbol, timeframe)
    if (
        len(cached) >= limit
        and cache.is_fresh(symbol, timeframe, config.data.ohlcv_cache_ttl_hours)
    ):
        return cached.tail(limit).reset_index(drop=True)

    fresh = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
    merged = cache.merge(cached, fresh)
    cache.save(symbol, timeframe, merged)
    return merged.tail(limit).reset_index(drop=True)


def _fetch_range_from_exchange(
    exchange: ExchangeClient,
    symbol: str,
    timeframe: str,
    start: pd.Timestamp,
    end: pd.Timestamp,
) -> pd.DataFrame:
    fetch_range = getattr(exchange, "fetch_ohlcv_range", None)
    if callable(fetch_range):
        return fetch_range(symbol, timeframe, start, end)

    candles = exchange.fetch_ohlcv(symbol, timeframe, limit=10000)
    return _filter_range(candles, start, end)


def fetch_ohlcv_for_backtest(
    config: AppConfig,
    exchange: ExchangeClient,
    symbol: str,
    timeframe: str,
) -> pd.DataFrame:
    start = pd.Timestamp(config.backtest.start_date, tz="UTC")
    end = pd.Timestamp(config.backtest.end_date, tz="UTC") + pd.Timedelta(days=1)

    if not config.data.ohlcv_cache_enabled:
        return _fetch_range_from_exchange(exchange, symbol, timeframe, start, end)

    cache = get_cache(config)
    cached = cache.load(symbol, timeframe)
    if _covers_range(cached, start, end):
        return _filter_range(cached, start, end)

    fetched = _fetch_range_from_exchange(exchange, symbol, timeframe, start, end)
    merged = cache.merge(cached, fetched)
    cache.save(symbol, timeframe, merged)
    return _filter_range(merged, start, end)
