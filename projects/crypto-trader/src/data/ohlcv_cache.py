from __future__ import annotations

from pathlib import Path

import pandas as pd

OHLCV_COLUMNS = ["timestamp", "open", "high", "low", "close", "volume"]


def symbol_cache_name(symbol: str) -> str:
    return symbol.replace("/", "_")


class OhlcvCache:
    """本地 CSV K 線快取。"""

    def __init__(self, exchange_id: str, cache_dir: Path | str) -> None:
        self.exchange_id = exchange_id
        self.root = Path(cache_dir)
        self.cache_dir = self.root / exchange_id

    def path(self, symbol: str, timeframe: str) -> Path:
        filename = f"{symbol_cache_name(symbol)}_{timeframe}.csv"
        return self.cache_dir / filename

    def load(self, symbol: str, timeframe: str) -> pd.DataFrame:
        path = self.path(symbol, timeframe)
        if not path.exists():
            return pd.DataFrame(columns=OHLCV_COLUMNS)
        df = pd.read_csv(path, parse_dates=["timestamp"])
        if df["timestamp"].dt.tz is None:
            df["timestamp"] = df["timestamp"].dt.tz_localize("UTC")
        return df.sort_values("timestamp").reset_index(drop=True)

    def save(self, symbol: str, timeframe: str, df: pd.DataFrame) -> None:
        if df.empty:
            return
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        out = df.sort_values("timestamp").reset_index(drop=True)
        out.to_csv(self.path(symbol, timeframe), index=False)

    @staticmethod
    def merge(left: pd.DataFrame, right: pd.DataFrame) -> pd.DataFrame:
        if left.empty:
            return right.sort_values("timestamp").reset_index(drop=True)
        if right.empty:
            return left.sort_values("timestamp").reset_index(drop=True)
        merged = pd.concat([left, right], ignore_index=True)
        merged = merged.sort_values("timestamp").drop_duplicates(subset=["timestamp"], keep="last")
        return merged.reset_index(drop=True)

    def is_fresh(self, symbol: str, timeframe: str, ttl_hours: int) -> bool:
        path = self.path(symbol, timeframe)
        if not path.exists():
            return False
        age_seconds = pd.Timestamp.now("UTC").timestamp() - path.stat().st_mtime
        return age_seconds <= ttl_hours * 3600
