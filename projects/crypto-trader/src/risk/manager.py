from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from src.config import RiskConfig
from src.strategies.base import Signal, SignalAction


@dataclass
class Position:
    symbol: str
    side: str
    amount: float
    entry_price: float
    entry_value: float


@dataclass
class RiskState:
    day: date | None = None
    day_start_equity: float = 0.0
    trading_halted: bool = False
    halt_reason: str = ""


class RiskManager:
    def __init__(self, config: RiskConfig) -> None:
        self.config = config
        self.state = RiskState()

    def reset_daily(self, equity: float, today: date) -> None:
        if self.state.day != today:
            self.state.day = today
            self.state.day_start_equity = equity
            if self.state.trading_halted and "daily loss" in self.state.halt_reason:
                self.state.trading_halted = False
                self.state.halt_reason = ""

    def update_equity(self, equity: float, today: date) -> None:
        self.reset_daily(equity, today)
        if self.state.day_start_equity <= 0:
            return
        daily_pnl_pct = (equity - self.state.day_start_equity) / self.state.day_start_equity
        if daily_pnl_pct <= -self.config.max_daily_loss_pct:
            self.state.trading_halted = True
            self.state.halt_reason = f"daily loss limit hit ({daily_pnl_pct:.2%})"

    def can_open_position(self, equity: float, position_value: float, open_positions: int) -> tuple[bool, str]:
        if self.state.trading_halted:
            return False, self.state.halt_reason or "trading halted"
        if position_value > equity * self.config.max_position_pct:
            return False, f"position exceeds max {self.config.max_position_pct:.0%}"
        return True, ""

    def apply_stop_take(self, position: Position, current_price: float) -> Signal | None:
        if position.side != "long":
            return None
        pnl_pct = (current_price - position.entry_price) / position.entry_price
        if pnl_pct <= -self.config.stop_loss_pct:
            return Signal(SignalAction.SELL, strength=1.0, reason=f"stop loss {pnl_pct:.2%}")
        if pnl_pct >= self.config.take_profit_pct:
            return Signal(SignalAction.SELL, strength=1.0, reason=f"take profit {pnl_pct:.2%}")
        return None

    def adjust_order_size(self, equity: float, requested_usd: float) -> float:
        max_usd = equity * self.config.max_position_pct
        return min(requested_usd, max_usd)
