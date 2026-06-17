from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import pandas as pd

from src.config import AppConfig
from src.exchange.base import ExchangeClient
from src.portfolio.tracker import PortfolioTracker
from src.risk.manager import RiskManager
from src.strategies import get_strategy
from src.strategies.base import SignalAction
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


@dataclass
class BacktestResult:
    equity_curve: pd.DataFrame
    trades: pd.DataFrame
    metrics: dict[str, float]


class BacktestEngine:
    def __init__(self, config: AppConfig, exchange: ExchangeClient) -> None:
        self.config = config
        self.exchange = exchange
        self.strategy = get_strategy(config.strategy.name, config.strategy.params)
        self.risk = RiskManager(config.risk)
        self.portfolio = PortfolioTracker(config.backtest.initial_capital)
        self.fee_rate = config.backtest.fee_rate

    def run(self) -> BacktestResult:
        symbol = self.config.trading.symbol
        timeframe = self.config.trading.timeframe
        candles = self.exchange.fetch_ohlcv(symbol, timeframe, limit=1000)
        candles = candles.sort_values("timestamp").reset_index(drop=True)

        start = pd.Timestamp(self.config.backtest.start_date, tz="UTC")
        end = pd.Timestamp(self.config.backtest.end_date, tz="UTC") + pd.Timedelta(days=1)
        candles = candles[(candles["timestamp"] >= start) & (candles["timestamp"] < end)]
        if candles.empty:
            raise ValueError("No candles in backtest date range")

        warmup = self.strategy.warmup_bars()
        equity_rows: list[dict] = []

        for i in range(warmup, len(candles)):
            window = candles.iloc[: i + 1]
            row = candles.iloc[i]
            price = float(row["close"])
            ts = row["timestamp"].date()

            equity = self.portfolio.mark_equity({symbol: price})
            self.risk.update_equity(equity, ts)

            pos = self.portfolio.position(symbol)
            if pos:
                exit_signal = self.risk.apply_stop_take(pos, price)
                if exit_signal and exit_signal.action == SignalAction.SELL:
                    self._sell(symbol, pos.amount, price, exit_signal.reason)
                    equity = self.portfolio.mark_equity({symbol: price})
                    self.risk.update_equity(equity, ts)
                    equity_rows.append({"timestamp": row["timestamp"], "equity": equity})
                    continue

            signal = self.strategy.generate_signal(window)
            if signal.action == SignalAction.BUY and not pos:
                size_usd = self.risk.adjust_order_size(
                    equity, self.config.trading.base_order_size_usd * signal.strength
                )
                ok, reason = self.risk.can_open_position(equity, size_usd, self.portfolio.open_positions_count())
                if ok and size_usd > 0 and self.portfolio.cash >= size_usd:
                    amount = size_usd / price
                    self._buy(symbol, amount, price, signal.reason)
            elif signal.action == SignalAction.SELL and pos:
                self._sell(symbol, pos.amount, price, signal.reason)

            equity = self.portfolio.mark_equity({symbol: price})
            equity_rows.append({"timestamp": row["timestamp"], "equity": equity})

        equity_df = pd.DataFrame(equity_rows)
        trades_df = pd.DataFrame([t.__dict__ for t in self.portfolio.state.trades])
        metrics = self._compute_metrics(equity_df)
        return BacktestResult(equity_curve=equity_df, trades=trades_df, metrics=metrics)

    def _buy(self, symbol: str, amount: float, price: float, reason: str) -> None:
        self.portfolio.execute_trade(symbol, "buy", amount, price, self.fee_rate, reason, "backtest")
        logger.debug("BUY %s amount=%.6f price=%.2f reason=%s", symbol, amount, price, reason)

    def _sell(self, symbol: str, amount: float, price: float, reason: str) -> None:
        self.portfolio.execute_trade(symbol, "sell", amount, price, self.fee_rate, reason, "backtest")
        logger.debug("SELL %s amount=%.6f price=%.2f reason=%s", symbol, amount, price, reason)

    @staticmethod
    def _compute_metrics(equity_df: pd.DataFrame) -> dict[str, float]:
        if equity_df.empty:
            return {}
        start = float(equity_df["equity"].iloc[0])
        end = float(equity_df["equity"].iloc[-1])
        total_return = (end - start) / start if start else 0.0
        returns = equity_df["equity"].pct_change().dropna()
        sharpe = 0.0
        if not returns.empty and returns.std() > 0:
            sharpe = (returns.mean() / returns.std()) * (252**0.5)
        peak = equity_df["equity"].cummax()
        drawdown = (equity_df["equity"] - peak) / peak
        max_dd = float(drawdown.min()) if not drawdown.empty else 0.0
        return {
            "start_equity": start,
            "end_equity": end,
            "total_return_pct": total_return * 100,
            "max_drawdown_pct": max_dd * 100,
            "sharpe_ratio": float(sharpe),
            "bars": float(len(equity_df)),
        }
