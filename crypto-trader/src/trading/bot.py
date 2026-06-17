from __future__ import annotations

import time
from datetime import datetime, timezone

from src.config import AppConfig
from src.exchange.base import ExchangeClient
from src.notifications import NotificationManager
from src.portfolio.tracker import PortfolioTracker
from src.risk.manager import RiskManager
from src.strategies import get_strategy
from src.strategies.base import SignalAction
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


class TradingBot:
    """統一交易迴圈：支援 paper 與 live 模式。"""

    def __init__(
        self,
        config: AppConfig,
        exchange: ExchangeClient,
        portfolio: PortfolioTracker,
        live: bool = False,
        notifier: NotificationManager | None = None,
    ) -> None:
        self.config = config
        self.exchange = exchange
        self.portfolio = portfolio
        self.live = live
        self.strategy = get_strategy(config.strategy.name, config.strategy.params)
        self.risk = RiskManager(config.risk)
        self.fee_rate = config.backtest.fee_rate
        self.mode = "live" if live else "paper"
        self.notifier = notifier or NotificationManager(config.notifications)

    def run_once(self) -> None:
        symbol = self.config.trading.symbol
        timeframe = self.config.trading.timeframe
        candles = self.exchange.fetch_ohlcv(symbol, timeframe, limit=max(200, self.strategy.warmup_bars() + 10))
        ticker = self.exchange.fetch_ticker(symbol)
        price = float(ticker.get("last") or ticker.get("close") or candles["close"].iloc[-1])
        today = datetime.now(timezone.utc).date()

        equity = self.portfolio.mark_equity({symbol: price})
        self.risk.update_equity(equity, today)
        logger.info("[%s] %s price=%.2f equity=%.2f cash=%.2f", self.mode.upper(), symbol, price, equity, self.portfolio.cash)

        pos = self.portfolio.position(symbol)
        if pos:
            exit_signal = self.risk.apply_stop_take(pos, price)
            if exit_signal and exit_signal.action == SignalAction.SELL:
                self._execute_sell(symbol, pos.amount, price, exit_signal.reason)
                return

        signal = self.strategy.generate_signal(candles)
        logger.info("Signal: %s (%s)", signal.action.value, signal.reason)

        if signal.action == SignalAction.BUY and not pos:
            size_usd = self.risk.adjust_order_size(
                equity, self.config.trading.base_order_size_usd * signal.strength
            )
            ok, reason = self.risk.can_open_position(equity, size_usd, self.portfolio.open_positions_count())
            if not ok:
                logger.warning("Buy blocked: %s", reason)
                return
            if size_usd <= 0 or self.portfolio.cash < size_usd:
                logger.warning("Buy skipped: insufficient funds")
                return
            amount = size_usd / price
            self._execute_buy(symbol, amount, price, signal.reason)

        elif signal.action == SignalAction.SELL and pos:
            self._execute_sell(symbol, pos.amount, price, signal.reason)

    def run_forever(self) -> None:
        interval = self.config.trading.poll_interval_seconds
        logger.info("Starting %s bot on %s (%s), poll=%ds", self.mode, self.config.trading.symbol, self.config.strategy.name, interval)
        while True:
            try:
                self.run_once()
            except Exception:
                logger.exception("Error in trading loop")
            time.sleep(interval)

    def _execute_buy(self, symbol: str, amount: float, price: float, reason: str) -> None:
        if self.live:
            order = self.exchange.create_market_order(symbol, "buy", amount)
            price = order.price or price
            amount = order.amount or amount
            logger.info("LIVE BUY filled id=%s", order.id)
        trade = self.portfolio.execute_trade(symbol, "buy", amount, price, self.fee_rate, reason, self.mode)
        logger.info("BUY %s %.6f @ %.2f | %s", symbol, amount, price, reason)
        self.notifier.notify_trade(trade)

    def _execute_sell(self, symbol: str, amount: float, price: float, reason: str) -> None:
        if self.live:
            order = self.exchange.create_market_order(symbol, "sell", amount)
            price = order.price or price
            amount = order.amount or amount
            logger.info("LIVE SELL filled id=%s", order.id)
        trade = self.portfolio.execute_trade(symbol, "sell", amount, price, self.fee_rate, reason, self.mode)
        logger.info("SELL %s %.6f @ %.2f | %s", symbol, amount, price, reason)
        self.notifier.notify_trade(trade)
