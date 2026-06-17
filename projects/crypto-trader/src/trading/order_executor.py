from __future__ import annotations

from dataclasses import dataclass

from src.config import AppConfig, RiskConfig, TradingConfig
from src.exchange.base import ExchangeClient, OrderResult
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


@dataclass
class OrderFill:
    price: float
    amount: float
    order_id: str
    order_type: str


@dataclass
class OcoBracket:
    stop_price: float
    take_profit_price: float
    order_list_id: str = ""


def compute_limit_price(side: str, reference_price: float, offset_pct: float) -> float:
    if side == "buy":
        return reference_price * (1 + offset_pct)
    return reference_price * (1 + offset_pct)


def paper_limit_would_fill(side: str, limit_price: float, market_price: float) -> bool:
    if side == "buy":
        return market_price <= limit_price
    return market_price >= limit_price


def build_oco_bracket(entry_price: float, risk: RiskConfig) -> OcoBracket:
    stop_price = entry_price * (1 - risk.stop_loss_pct)
    take_profit_price = entry_price * (1 + risk.take_profit_pct)
    return OcoBracket(stop_price=stop_price, take_profit_price=take_profit_price)


class OrderExecutor:
    """依設定執行市價／限價單，並在實盤可掛 OCO 止損止盈。"""

    def __init__(self, config: AppConfig, exchange: ExchangeClient, live: bool) -> None:
        self.config = config
        self.exchange = exchange
        self.live = live
        self.trading = config.trading
        self.risk = config.risk

    def buy(self, symbol: str, amount: float, reference_price: float) -> OrderFill | None:
        order_type = self.trading.order_type.lower()
        if order_type == "limit":
            return self._limit_order(symbol, "buy", amount, reference_price)
        return self._market_order(symbol, "buy", amount, reference_price)

    def sell(self, symbol: str, amount: float, reference_price: float) -> OrderFill | None:
        order_type = self.trading.exit_order_type.lower()
        if order_type == "limit":
            return self._limit_order(symbol, "sell", amount, reference_price)
        return self._market_order(symbol, "sell", amount, reference_price)

    def place_oco_exit(self, symbol: str, amount: float, entry_price: float) -> OcoBracket | None:
        if not self.trading.oco_enabled or not self.live:
            return None
        bracket = build_oco_bracket(entry_price, self.risk)
        create_oco = getattr(self.exchange, "create_oco_order", None)
        if not callable(create_oco):
            logger.warning("Exchange does not support OCO orders; using software stop/take")
            return None
        result = create_oco(
            symbol,
            amount,
            bracket.take_profit_price,
            bracket.stop_price,
        )
        bracket.order_list_id = result
        logger.info(
            "OCO placed %s amount=%.6f stop=%.2f take=%.2f id=%s",
            symbol,
            amount,
            bracket.stop_price,
            bracket.take_profit_price,
            result,
        )
        return bracket

    def uses_exchange_oco(self) -> bool:
        return self.trading.oco_enabled and self.live

    def _market_order(
        self, symbol: str, side: str, amount: float, reference_price: float
    ) -> OrderFill:
        if self.live:
            order = self.exchange.create_market_order(symbol, side, amount)
            return OrderFill(
                price=order.price or reference_price,
                amount=order.amount or amount,
                order_id=order.id,
                order_type="market",
            )
        return OrderFill(
            price=reference_price,
            amount=amount,
            order_id=f"paper-{side}",
            order_type="market",
        )

    def _limit_order(
        self, symbol: str, side: str, amount: float, reference_price: float
    ) -> OrderFill | None:
        offset = (
            self.trading.limit_buy_offset_pct
            if side == "buy"
            else self.trading.limit_sell_offset_pct
        )
        limit_price = compute_limit_price(side, reference_price, offset)

        if self.live:
            order = self.exchange.create_limit_order(symbol, side, amount, limit_price)
            if order.status not in {"closed", "filled"}:
                logger.info(
                    "Limit %s submitted id=%s price=%.2f (status=%s)",
                    side,
                    order.id,
                    limit_price,
                    order.status,
                )
            return OrderFill(
                price=order.price or limit_price,
                amount=order.amount or amount,
                order_id=order.id,
                order_type="limit",
            )

        if not paper_limit_would_fill(side, limit_price, reference_price):
            logger.info(
                "Paper limit %s not filled: limit=%.2f market=%.2f",
                side,
                limit_price,
                reference_price,
            )
            return None

        return OrderFill(
            price=limit_price,
            amount=amount,
            order_id=f"paper-limit-{side}",
            order_type="limit",
        )
