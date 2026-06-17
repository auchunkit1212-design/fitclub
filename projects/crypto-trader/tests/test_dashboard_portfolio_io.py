from __future__ import annotations

import json
from pathlib import Path

from src.dashboard.portfolio_io import load_portfolio_snapshot


def test_load_portfolio_snapshot_missing_file(tmp_path: Path) -> None:
    snap = load_portfolio_snapshot(tmp_path / "missing.json")
    assert snap.cash == 0.0
    assert snap.positions == {}
    assert snap.trades == []
    assert snap.equity_history == []


def test_load_portfolio_snapshot_parses_json(tmp_path: Path) -> None:
    p = tmp_path / "portfolio.json"
    payload = {
        "cash": 1234.56,
        "positions": {
            "BTC/USDT": {
                "symbol": "BTC/USDT",
                "side": "long",
                "amount": 0.01,
                "entry_price": 50000.0,
                "entry_value": 500.0,
            }
        },
        "trades": [
            {
                "timestamp": "2026-06-17T07:40:00+00:00",
                "symbol": "BTC/USDT",
                "side": "buy",
                "amount": 0.01,
                "price": 50000.0,
                "value": 500.0,
                "fee": 0.5,
                "reason": "test",
                "mode": "paper",
            }
        ],
        "equity_history": [{"timestamp": "2026-06-17T00:00:00+00:00", "equity": 1234.56}],
    }
    p.write_text(json.dumps(payload), encoding="utf-8")

    snap = load_portfolio_snapshot(p)
    assert snap.cash == 1234.56
    assert "BTC/USDT" in snap.positions
    assert len(snap.trades) == 1
    assert len(snap.equity_history) == 1

