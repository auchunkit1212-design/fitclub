from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class PortfolioSnapshot:
    cash: float
    positions: dict[str, dict[str, Any]]
    trades: list[dict[str, Any]]
    equity_history: list[dict[str, Any]]
    source_path: str


def load_portfolio_snapshot(path: str | Path) -> PortfolioSnapshot:
    p = Path(path)
    source = str(p)
    if not p.exists():
        return PortfolioSnapshot(
            cash=0.0,
            positions={},
            trades=[],
            equity_history=[],
            source_path=source,
        )

    data = json.loads(p.read_text(encoding="utf-8"))
    return PortfolioSnapshot(
        cash=float(data.get("cash", 0.0)),
        positions=dict(data.get("positions", {}) or {}),
        trades=list(data.get("trades", []) or []),
        equity_history=list(data.get("equity_history", []) or []),
        source_path=source,
    )

