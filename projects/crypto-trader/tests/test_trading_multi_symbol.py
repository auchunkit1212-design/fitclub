from __future__ import annotations

from src.config import (
    AppConfig,
    BacktestConfig,
    ExchangeConfig,
    NotificationsConfig,
    RiskConfig,
    StrategyConfig,
    TradingConfig,
)
from src.exchange.mock_client import MockExchangeClient
from src.portfolio.tracker import PortfolioTracker
from src.trading.bot import TradingBot


def _bot_with_trading(trading: TradingConfig) -> TradingBot:
    config = AppConfig(
        mode="paper",
        exchange=ExchangeConfig(),
        trading=trading,
        strategy=StrategyConfig(name="sma_crossover", params={"fast_period": 3, "slow_period": 8}),
        risk=RiskConfig(),
        backtest=BacktestConfig(),
        notifications=NotificationsConfig(enabled=False),
    )
    return TradingBot(
        config=config,
        exchange=MockExchangeClient(),
        portfolio=PortfolioTracker(initial_cash=10000),
        live=False,
    )


def test_symbols_uses_list_when_provided() -> None:
    bot = _bot_with_trading(
        TradingConfig(
            symbol="BTC/USDT",
            symbols=["BTC/USDT", "ETH/USDT", "BTC/USDT"],
        )
    )
    assert bot._symbols() == ["BTC/USDT", "ETH/USDT"]


def test_symbols_fallback_to_single_symbol() -> None:
    bot = _bot_with_trading(TradingConfig(symbol="BTC/USDT", symbols=[]))
    assert bot._symbols() == ["BTC/USDT"]


def test_order_size_respects_symbol_allocation() -> None:
    trading = TradingConfig(
        symbol="BTC/USDT",
        base_order_size_usd=500,
        symbol_allocations={"BTC/USDT": 0.2},
    )
    bot = _bot_with_trading(trading)
    # equity * 20% = 2000, current_position=1800, remaining=200 -> min(500, 200)=200
    size = bot._order_size_usd("BTC/USDT", equity=10000, signal_strength=1.0, current_position_value=1800)
    assert size == 200

