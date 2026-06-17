from __future__ import annotations

from abc import ABC, abstractmethod

from src.portfolio.tracker import TradeRecord


def format_trade_message(trade: TradeRecord) -> str:
    side_label = "買入" if trade.side == "buy" else "賣出"
    emoji = "🟢" if trade.side == "buy" else "🔴"
    mode = trade.mode.upper()
    return (
        f"{emoji} {side_label}成交 [{mode}]\n"
        f"交易對: {trade.symbol}\n"
        f"數量: {trade.amount:.6f}\n"
        f"價格: {trade.price:,.2f}\n"
        f"金額: {trade.value:,.2f}\n"
        f"手續費: {trade.fee:.4f}\n"
        f"原因: {trade.reason}\n"
        f"時間: {trade.timestamp}"
    )


class Notifier(ABC):
    name: str = "base"

    @abstractmethod
    def send(self, message: str) -> bool:
        raise NotImplementedError

    def notify_trade(self, trade: TradeRecord) -> bool:
        return self.send(format_trade_message(trade))
