import pandas as pd

from src.risk.manager import Position, RiskManager
from src.config import RiskConfig
from src.strategies.base import SignalAction
from src.strategies.macd_rsi_filter_strategy import MacdRsiFilterStrategy
from src.strategies.macd_strategy import MacdStrategy
from src.strategies.sma_crossover import SmaCrossoverStrategy
from src.strategies.rsi_strategy import RsiStrategy
from src.portfolio.tracker import PortfolioTracker


def _sample_candles(n: int = 60) -> pd.DataFrame:
    import numpy as np

    ts = pd.date_range("2024-01-01", periods=n, freq="h", tz="UTC")
    close = pd.Series(np.linspace(100, 120, n) + np.sin(np.arange(n)) * 2)
    return pd.DataFrame(
        {
            "timestamp": ts,
            "open": close - 0.5,
            "high": close + 1,
            "low": close - 1,
            "close": close,
            "volume": 1000,
        }
    )


def test_sma_strategy_returns_signal():
    strategy = SmaCrossoverStrategy({"fast_period": 3, "slow_period": 8})
    signal = strategy.generate_signal(_sample_candles(30))
    assert signal.action in SignalAction


def test_rsi_strategy_returns_signal():
    strategy = RsiStrategy({"period": 14})
    signal = strategy.generate_signal(_sample_candles(30))
    assert signal.action in SignalAction


def test_macd_strategy_returns_signal():
    strategy = MacdStrategy({"fast_period": 12, "slow_period": 26, "signal_period": 9})
    signal = strategy.generate_signal(_sample_candles(60))
    assert signal.action in SignalAction


def test_macd_rsi_filter_strategy_returns_signal():
    strategy = MacdRsiFilterStrategy(
        {
            "fast_period": 12,
            "slow_period": 26,
            "signal_period": 9,
            "rsi_period": 14,
            "rsi_buy_max": 60,
            "rsi_sell_min": 40,
        }
    )
    signal = strategy.generate_signal(_sample_candles(100))
    assert signal.action in SignalAction


def test_risk_stop_loss_triggers_sell():
    risk = RiskManager(RiskConfig(stop_loss_pct=0.02, take_profit_pct=0.1))
    pos = Position(symbol="BTC/USDT", side="long", amount=1, entry_price=100, entry_value=100)
    signal = risk.apply_stop_take(pos, 97)
    assert signal is not None
    assert signal.action == SignalAction.SELL


def test_portfolio_buy_sell_roundtrip():
    p = PortfolioTracker(initial_cash=1000)
    p.execute_trade("BTC/USDT", "buy", 0.01, 50000, 0.001, "test", "paper")
    assert p.position("BTC/USDT") is not None
    p.execute_trade("BTC/USDT", "sell", 0.01, 51000, 0.001, "test", "paper")
    assert p.position("BTC/USDT") is None
    assert p.cash > 1000
