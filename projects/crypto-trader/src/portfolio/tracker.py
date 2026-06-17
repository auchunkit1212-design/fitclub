from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.config import ROOT_DIR
from src.risk.manager import Position


@dataclass
class TradeRecord:
    timestamp: str
    symbol: str
    side: str
    amount: float
    price: float
    value: float
    fee: float
    reason: str
    mode: str


@dataclass
class PortfolioState:
    cash: float
    positions: dict[str, Position] = field(default_factory=dict)
    trades: list[TradeRecord] = field(default_factory=list)
    equity_history: list[dict[str, Any]] = field(default_factory=list)


class PortfolioTracker:
    def __init__(self, initial_cash: float, persist_path: str | None = None) -> None:
        self.state = PortfolioState(cash=initial_cash)
        self.persist_path = ROOT_DIR / persist_path if persist_path else None
        if self.persist_path and self.persist_path.exists():
            self._load()

    @property
    def cash(self) -> float:
        return self.state.cash

    def position(self, symbol: str) -> Position | None:
        return self.state.positions.get(symbol)

    def open_positions_count(self) -> int:
        return len(self.state.positions)

    def mark_equity(self, prices: dict[str, float]) -> float:
        equity = self.state.cash
        for symbol, pos in self.state.positions.items():
            price = prices.get(symbol, pos.entry_price)
            equity += pos.amount * price
        self.state.equity_history.append(
            {"timestamp": datetime.now(timezone.utc).isoformat(), "equity": equity}
        )
        return equity

    def execute_trade(
        self,
        symbol: str,
        side: str,
        amount: float,
        price: float,
        fee_rate: float,
        reason: str,
        mode: str,
    ) -> TradeRecord:
        value = amount * price
        fee = value * fee_rate

        if side == "buy":
            total_cost = value + fee
            if total_cost > self.state.cash:
                raise ValueError("insufficient cash")
            self.state.cash -= total_cost
            existing = self.state.positions.get(symbol)
            if existing:
                new_amount = existing.amount + amount
                avg_price = (existing.entry_value + value) / new_amount
                self.state.positions[symbol] = Position(
                    symbol=symbol,
                    side="long",
                    amount=new_amount,
                    entry_price=avg_price,
                    entry_value=existing.entry_value + value,
                )
            else:
                self.state.positions[symbol] = Position(
                    symbol=symbol,
                    side="long",
                    amount=amount,
                    entry_price=price,
                    entry_value=value,
                )
        elif side == "sell":
            pos = self.state.positions.get(symbol)
            if not pos or pos.amount < amount:
                raise ValueError("insufficient position")
            proceeds = value - fee
            self.state.cash += proceeds
            remaining = pos.amount - amount
            if remaining <= 1e-12:
                del self.state.positions[symbol]
            else:
                ratio = remaining / pos.amount
                self.state.positions[symbol] = Position(
                    symbol=symbol,
                    side="long",
                    amount=remaining,
                    entry_price=pos.entry_price,
                    entry_value=pos.entry_value * ratio,
                )
        else:
            raise ValueError(f"unsupported side: {side}")

        record = TradeRecord(
            timestamp=datetime.now(timezone.utc).isoformat(),
            symbol=symbol,
            side=side,
            amount=amount,
            price=price,
            value=value,
            fee=fee,
            reason=reason,
            mode=mode,
        )
        self.state.trades.append(record)
        self._save()
        return record

    def _save(self) -> None:
        if not self.persist_path:
            return
        self.persist_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "cash": self.state.cash,
            "positions": {k: asdict(v) for k, v in self.state.positions.items()},
            "trades": [asdict(t) for t in self.state.trades[-500:]],
            "equity_history": self.state.equity_history[-2000:],
        }
        self.persist_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _load(self) -> None:
        if not self.persist_path or not self.persist_path.exists():
            return
        data = json.loads(self.persist_path.read_text(encoding="utf-8"))
        self.state.cash = float(data.get("cash", self.state.cash))
        self.state.positions = {
            k: Position(**v) for k, v in data.get("positions", {}).items()
        }
        self.state.trades = [TradeRecord(**t) for t in data.get("trades", [])]
        self.state.equity_history = data.get("equity_history", [])
