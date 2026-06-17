#!/usr/bin/env python3
"""查看模擬／實盤組合狀態。"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rich.console import Console
from rich.table import Table

console = Console()


def show_portfolio(path: Path) -> None:
    if not path.exists():
        console.print(f"[yellow]No portfolio file: {path}[/yellow]")
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    table = Table(title=f"Portfolio — {path.name}")
    table.add_column("Field")
    table.add_column("Value", justify="right")
    table.add_row("Cash", f"{data.get('cash', 0):.2f}")
    positions = data.get("positions", {})
    table.add_row("Open positions", str(len(positions)))
    for sym, pos in positions.items():
        table.add_row(f"  {sym}", f"{pos['amount']:.6f} @ {pos['entry_price']:.2f}")
    trades = data.get("trades", [])
    table.add_row("Total trades", str(len(trades)))
    if trades:
        last = trades[-1]
        table.add_row("Last trade", f"{last['side']} {last['symbol']} @ {last['price']}")
    console.print(table)


def main() -> None:
    show_portfolio(ROOT / "data" / "paper_portfolio.json")
    show_portfolio(ROOT / "data" / "live_portfolio.json")


if __name__ == "__main__":
    main()
