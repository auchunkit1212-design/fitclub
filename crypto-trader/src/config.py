from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = ROOT_DIR / "config" / "settings.yaml"


@dataclass
class ExchangeConfig:
    id: str = "binance"
    sandbox: bool = True
    rate_limit: bool = True
    api_key: str = ""
    api_secret: str = ""
    api_passphrase: str = ""


@dataclass
class TradingConfig:
    symbol: str = "BTC/USDT"
    symbols: list[str] = field(default_factory=list)
    symbol_allocations: dict[str, float] = field(default_factory=dict)
    timeframe: str = "1h"
    quote_currency: str = "USDT"
    base_order_size_usd: float = 100.0
    max_open_positions: int = 1
    poll_interval_seconds: int = 60


@dataclass
class StrategyConfig:
    name: str = "sma_crossover"
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskConfig:
    max_position_pct: float = 0.25
    max_daily_loss_pct: float = 0.05
    stop_loss_pct: float = 0.03
    take_profit_pct: float = 0.06
    max_slippage_pct: float = 0.002


@dataclass
class BacktestConfig:
    start_date: str = "2024-01-01"
    end_date: str = "2024-12-31"
    initial_capital: float = 10000.0
    fee_rate: float = 0.001


@dataclass
class LoggingConfig:
    level: str = "INFO"
    file: str = "logs/trader.log"


@dataclass
class NotificationsConfig:
    enabled: bool = False
    telegram: bool = True
    discord: bool = False
    notify_modes: list[str] = field(default_factory=lambda: ["paper", "live"])
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    discord_webhook_url: str = ""


@dataclass
class DataConfig:
    ohlcv_cache_enabled: bool = True
    ohlcv_cache_dir: str = "data/ohlcv"
    ohlcv_cache_ttl_hours: int = 24


@dataclass
class AppConfig:
    mode: str = "paper"
    exchange: ExchangeConfig = field(default_factory=ExchangeConfig)
    trading: TradingConfig = field(default_factory=TradingConfig)
    strategy: StrategyConfig = field(default_factory=StrategyConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    backtest: BacktestConfig = field(default_factory=BacktestConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    notifications: NotificationsConfig = field(default_factory=NotificationsConfig)
    data: DataConfig = field(default_factory=DataConfig)


def _merge_dataclass(cls: type, data: dict[str, Any] | None) -> Any:
    if not data:
        return cls()
    fields = {f.name for f in cls.__dataclass_fields__.values()}  # type: ignore[attr-defined]
    return cls(**{k: v for k, v in data.items() if k in fields})


def load_config(path: Path | str | None = None) -> AppConfig:
    load_dotenv(ROOT_DIR / ".env")
    config_path = Path(path) if path else DEFAULT_CONFIG_PATH
    raw: dict[str, Any] = {}
    if config_path.exists():
        with config_path.open(encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}

    exchange = _merge_dataclass(ExchangeConfig, raw.get("exchange"))
    exchange.api_key = os.getenv("API_KEY", exchange.api_key)
    exchange.api_secret = os.getenv("API_SECRET", exchange.api_secret)
    exchange.api_passphrase = os.getenv("API_PASSPHRASE", exchange.api_passphrase)
    if os.getenv("EXCHANGE_ID"):
        exchange.id = os.getenv("EXCHANGE_ID", exchange.id)
    if os.getenv("USE_TESTNET", "").lower() in {"1", "true", "yes"}:
        exchange.sandbox = True

    logging_cfg = _merge_dataclass(LoggingConfig, raw.get("logging"))
    if os.getenv("LOG_LEVEL"):
        logging_cfg.level = os.getenv("LOG_LEVEL", logging_cfg.level)

    notifications = _merge_dataclass(NotificationsConfig, raw.get("notifications"))
    notifications.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN", notifications.telegram_bot_token)
    notifications.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID", notifications.telegram_chat_id)
    notifications.discord_webhook_url = os.getenv("DISCORD_WEBHOOK_URL", notifications.discord_webhook_url)
    if os.getenv("NOTIFICATIONS_ENABLED", "").lower() in {"1", "true", "yes"}:
        notifications.enabled = True

    return AppConfig(
        mode=raw.get("mode", "paper"),
        exchange=exchange,
        trading=_merge_dataclass(TradingConfig, raw.get("trading")),
        strategy=_merge_dataclass(StrategyConfig, raw.get("strategy")),
        risk=_merge_dataclass(RiskConfig, raw.get("risk")),
        backtest=_merge_dataclass(BacktestConfig, raw.get("backtest")),
        logging=logging_cfg,
        notifications=notifications,
        data=_merge_dataclass(DataConfig, raw.get("data")),
    )
